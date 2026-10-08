use crate::error::{TimetrackError, TimetrackResult};
use crate::state::Db;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use hmac::Mac;
use rusqlite::{params, Connection, OptionalExtension};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{verify_tls12_signature, verify_tls13_signature, CryptoProvider};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName, UnixTime};
use rustls::server::danger::{ClientCertVerified, ClientCertVerifier};
use rustls::{ClientConfig, DigitallySignedStruct, DistinguishedName, ServerConfig, SignatureScheme};
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_rustls::{TlsAcceptor, TlsConnector};

/// The port the LAN listener binds unless `PORT_ENV` names another.
pub const DEFAULT_PORT: u16 = 52741;
pub const PORT_ENV: &str = "TIMETRACK_PEER_PORT";

const OFFER_LIFETIME: Duration = Duration::from_secs(5 * 60);
const MAX_ATTEMPTS: u32 = 5;
const MAX_FRAME_BYTES: usize = 64 * 1024;
const EXCHANGE_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_CONNECTIONS: usize = 8;

/// The name the certificate carries and the client asks for. Nothing checks it: a peer is known by
/// its certificate's fingerprint, not by a name a CA vouched for.
const TLS_NAME: &str = "timetrack";
const SPAKE_IDENTITY: &[u8] = b"timetrack-pair-v1";
const CLIENT_CONFIRM: &[u8] = b"timetrack-pair-v1 client";
const SERVER_CONFIRM: &[u8] = b"timetrack-pair-v1 server";

type KeySource = Arc<dyn Fn() -> TimetrackResult<String> + Send + Sync>;

fn rejected(error: impl std::fmt::Display) -> TimetrackError {
    TimetrackError::Rejected(error.to_string())
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn fingerprint(cert: &CertificateDer<'_>) -> String {
    use sha2::Digest;

    hex(&sha2::Sha256::digest(cert.as_ref()))
}

#[derive(Serialize, Deserialize)]
struct StoredKey {
    cert: String,
    key: String,
}

/// A new private key and a self-signed certificate for it, serialized for the keychain.
pub fn generate_key() -> TimetrackResult<String> {
    let certified = rcgen::generate_simple_self_signed(vec![TLS_NAME.to_string()]).map_err(rejected)?;

    Ok(serde_json::to_string(&StoredKey {
        cert: BASE64.encode(certified.cert.der()),
        key: BASE64.encode(certified.signing_key.serialize_der()),
    })?)
}

fn provider() -> Arc<CryptoProvider> {
    Arc::new(rustls::crypto::aws_lc_rs::default_provider())
}

/// Accepts whatever certificate the other side presents, as long as it proves it holds the key.
///
/// Who a certificate belongs to is decided above TLS, by its fingerprint: a paired one gets full
/// access, an unknown one only the pairing exchange.
#[derive(Debug)]
struct AnyCertificate(Arc<CryptoProvider>);

impl AnyCertificate {
    fn tls12(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls12_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }

    fn tls13(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls13_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }

    fn schemes(&self) -> Vec<SignatureScheme> {
        self.0.signature_verification_algorithms.supported_schemes()
    }
}

impl ClientCertVerifier for AnyCertificate {
    fn root_hint_subjects(&self) -> &[DistinguishedName] {
        &[]
    }

    fn verify_client_cert(
        &self,
        _: &CertificateDer<'_>,
        _: &[CertificateDer<'_>],
        _: UnixTime,
    ) -> Result<ClientCertVerified, rustls::Error> {
        Ok(ClientCertVerified::assertion())
    }

    fn client_auth_mandatory(&self) -> bool {
        true
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.tls12(message, cert, dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.tls13(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.schemes()
    }
}

impl ServerCertVerifier for AnyCertificate {
    fn verify_server_cert(
        &self,
        _: &CertificateDer<'_>,
        _: &[CertificateDer<'_>],
        _: &ServerName<'_>,
        _: &[u8],
        _: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.tls12(message, cert, dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.tls13(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.schemes()
    }
}

/// Who this machine is on the wire: the store's machine id, a label for people, and the certificate
/// whose fingerprint a peer pins.
struct Identity {
    machine_id: String,
    label: String,
    fingerprint: String,
    server: Arc<ServerConfig>,
    client: Arc<ClientConfig>,
}

impl Identity {
    fn new(machine_id: String, label: String, stored: &str) -> TimetrackResult<Self> {
        let stored: StoredKey = serde_json::from_str(stored)?;
        let cert = CertificateDer::from(BASE64.decode(stored.cert).map_err(rejected)?);
        let key = BASE64.decode(stored.key).map_err(rejected)?;
        let private = || PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key.clone()));
        let verifier = Arc::new(AnyCertificate(provider()));
        let server = ServerConfig::builder_with_provider(provider())
            .with_protocol_versions(&[&rustls::version::TLS13])
            .map_err(rejected)?
            .with_client_cert_verifier(verifier.clone())
            .with_single_cert(vec![cert.clone()], private())
            .map_err(rejected)?;
        let client = ClientConfig::builder_with_provider(provider())
            .with_protocol_versions(&[&rustls::version::TLS13])
            .map_err(rejected)?
            .dangerous()
            .with_custom_certificate_verifier(verifier)
            .with_client_auth_cert(vec![cert.clone()], private())
            .map_err(rejected)?;

        Ok(Self {
            machine_id,
            label,
            fingerprint: fingerprint(&cert),
            server: Arc::new(server),
            client: Arc::new(client),
        })
    }
}

fn peer_fingerprint(certificates: Option<&[CertificateDer<'static>]>) -> TimetrackResult<String> {
    certificates
        .and_then(|chain| chain.first())
        .map(fingerprint)
        .ok_or_else(|| rejected("the other machine presented no certificate"))
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
enum Frame {
    #[serde(rename_all = "camelCase")]
    Pair {
        machine_id: String,
        label: String,
        port: Option<u16>,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    Confirm { mac: String },
    #[serde(rename_all = "camelCase")]
    Hello {
        machine_id: String,
        label: String,
        app_version: String,
        now_ms: i64,
        port: Option<u16>,
    },
    #[serde(rename_all = "camelCase")]
    Offset { offset_ms: i64 },
    #[serde(rename_all = "camelCase")]
    Refused { message: String },
}

async fn write_frame<S: AsyncWrite + Unpin>(stream: &mut S, frame: &Frame) -> TimetrackResult<()> {
    let body = serde_json::to_vec(frame)?;
    let length = u32::try_from(body.len()).map_err(rejected)?;

    stream.write_all(&length.to_be_bytes()).await?;
    stream.write_all(&body).await?;
    stream.flush().await?;

    Ok(())
}

async fn read_frame<S: AsyncRead + Unpin>(stream: &mut S) -> TimetrackResult<Frame> {
    let mut length = [0u8; 4];

    stream.read_exact(&mut length).await?;

    let length = u32::from_be_bytes(length) as usize;

    if length > MAX_FRAME_BYTES {
        return Err(rejected("the other machine sent a frame that is too large"));
    }

    let mut body = vec![0u8; length];

    stream.read_exact(&mut body).await?;

    Ok(serde_json::from_slice(&body)?)
}

async fn refuse<S: AsyncWrite + Unpin>(stream: &mut S, message: &str) -> TimetrackResult<()> {
    write_frame(
        stream,
        &Frame::Refused {
            message: message.to_string(),
        },
    )
    .await?;
    stream.shutdown().await?;

    Err(rejected(message))
}

/// What both sides of one pairing connection saw, in an order both agree on.
///
/// The fingerprints are each side's own view of this TLS session. A machine in the middle runs two
/// sessions with two certificates of its own, so the two ends hold different transcripts and neither
/// confirmation verifies, even when it relayed the right code.
struct Transcript<'a> {
    server_fingerprint: &'a str,
    client_fingerprint: &'a str,
    server_machine_id: &'a str,
    client_machine_id: &'a str,
    server_label: &'a str,
    client_label: &'a str,
}

impl Transcript<'_> {
    fn mac(&self, key: &[u8], role: &[u8]) -> hmac::Hmac<sha2::Sha256> {
        let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(key).expect("hmac takes a key of any length");

        mac.update(role);

        for part in [
            self.server_fingerprint,
            self.client_fingerprint,
            self.server_machine_id,
            self.client_machine_id,
            self.server_label,
            self.client_label,
        ] {
            mac.update(&(part.len() as u32).to_be_bytes());
            mac.update(part.as_bytes());
        }

        mac
    }

    fn confirm(&self, key: &[u8], role: &[u8]) -> String {
        BASE64.encode(self.mac(key, role).finalize().into_bytes())
    }

    fn verifies(&self, key: &[u8], role: &[u8], offered: &str) -> bool {
        BASE64
            .decode(offered)
            .is_ok_and(|offered| self.mac(key, role).verify_slice(&offered).is_ok())
    }
}

fn start_spake(code: &str) -> (spake2::Spake2<spake2::Ed25519Group>, Vec<u8>) {
    spake2::Spake2::<spake2::Ed25519Group>::start_symmetric(
        &spake2::Password::new(code.as_bytes()),
        &spake2::Identity::new(SPAKE_IDENTITY),
    )
}

fn finish_spake(state: spake2::Spake2<spake2::Ed25519Group>, inbound: &str) -> Option<Vec<u8>> {
    state.finish(&BASE64.decode(inbound).ok()?).ok()
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PairedMachine {
    pub machine_id: String,
    pub label: String,
    pub cert_fingerprint: String,
    pub last_addr: Option<String>,
    pub last_seen_ms: Option<i64>,
    pub clock_offset_ms: Option<i64>,
    pub paired_at_ms: i64,
}

const PAIRED_COLUMNS: &str =
    "machine_id, label, cert_fingerprint, last_addr, last_seen_ms, clock_offset_ms, paired_at_ms";

fn paired_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PairedMachine> {
    Ok(PairedMachine {
        machine_id: row.get(0)?,
        label: row.get(1)?,
        cert_fingerprint: row.get(2)?,
        last_addr: row.get(3)?,
        last_seen_ms: row.get(4)?,
        clock_offset_ms: row.get(5)?,
        paired_at_ms: row.get(6)?,
    })
}

fn paired_where(connection: &Connection, column: &str, value: &str) -> TimetrackResult<Option<PairedMachine>> {
    Ok(connection
        .query_row(
            &format!("SELECT {PAIRED_COLUMNS} FROM paired_machine WHERE {column} = ?1"),
            params![value],
            paired_from_row,
        )
        .optional()?)
}

fn store_pairing(
    connection: &mut Connection,
    machine_id: &str,
    label: &str,
    cert_fingerprint: &str,
    last_addr: Option<&str>,
) -> TimetrackResult<()> {
    let transaction = connection.transaction()?;

    transaction.execute(
        "DELETE FROM paired_machine WHERE cert_fingerprint = ?1 AND machine_id <> ?2",
        params![cert_fingerprint, machine_id],
    )?;
    transaction.execute(
        "INSERT INTO paired_machine (machine_id, label, cert_fingerprint, last_addr, paired_at_ms)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (machine_id) DO UPDATE SET
           label = ?2, cert_fingerprint = ?3, last_addr = ?4, paired_at_ms = ?5,
           last_seen_ms = NULL, clock_offset_ms = NULL",
        params![machine_id, label, cert_fingerprint, last_addr, now_ms()],
    )?;
    transaction.commit()?;

    Ok(())
}

struct Seen<'a> {
    machine_id: &'a str,
    label: &'a str,
    last_addr: Option<&'a str>,
    at_ms: i64,
    clock_offset_ms: i64,
}

fn store_seen(connection: &Connection, seen: &Seen<'_>) -> TimetrackResult<()> {
    connection.execute(
        "UPDATE paired_machine SET label = ?2, last_addr = COALESCE(?3, last_addr), last_seen_ms = ?4,
           clock_offset_ms = ?5
         WHERE machine_id = ?1",
        params![
            seen.machine_id,
            seen.label,
            seen.last_addr,
            seen.at_ms,
            seen.clock_offset_ms
        ],
    )?;

    Ok(())
}

fn address(ip: IpAddr, port: u16) -> String {
    SocketAddr::new(ip, port).to_string()
}

fn split_address(address: &str) -> TimetrackResult<(String, u16)> {
    let (host, port) = address
        .rsplit_once(':')
        .ok_or_else(|| rejected(format!("{address} names no port")))?;
    let port = port.parse().map_err(|_| rejected(format!("{address} names no port")))?;

    Ok((host.trim_start_matches('[').trim_end_matches(']').to_string(), port))
}

struct Offer {
    code: String,
    expires_at: Instant,
    attempts: u32,
}

/// Where the listener binds, which certificate it serves, and what it says about this machine.
pub struct PeerConfig {
    pub app_version: String,
    pub label: String,
    pub bind: SocketAddr,
    keys: KeySource,
}

impl PeerConfig {
    /// The app's own: the host name as label, every interface on `DEFAULT_PORT` or the `PORT_ENV`
    /// override, and the key in the keychain.
    pub fn for_app(app_version: String) -> Self {
        let port = std::env::var(PORT_ENV)
            .ok()
            .and_then(|value| value.trim().parse().ok())
            .unwrap_or(DEFAULT_PORT);

        Self {
            app_version,
            label: gethostname::gethostname().to_string_lossy().into_owned(),
            bind: SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), port),
            keys: Arc::new(|| crate::keychain::machine_key(generate_key)),
        }
    }
}

struct Inner {
    db: Db,
    config: PeerConfig,
    identity: tokio::sync::OnceCell<Arc<Identity>>,
    listening: tokio::sync::Mutex<Option<u16>>,
    offer: Mutex<Option<Offer>>,
}

/// The LAN side of the app: this machine's identity, the listener paired machines reach it on, and
/// the one pairing offer that may be open.
#[derive(Clone)]
pub struct Peers(Arc<Inner>);

impl Peers {
    pub fn new(db: Db, config: PeerConfig) -> Self {
        Self(Arc::new(Inner {
            db,
            config,
            identity: tokio::sync::OnceCell::new(),
            listening: tokio::sync::Mutex::new(None),
            offer: Mutex::new(None),
        }))
    }

    async fn identity(&self) -> TimetrackResult<Arc<Identity>> {
        self.0
            .identity
            .get_or_try_init(|| async {
                let machine_id = self
                    .0
                    .db
                    .run(|connection| {
                        Ok(
                            connection.query_row("SELECT machine_id FROM machine WHERE id = 1", [], |row| {
                                row.get::<_, String>(0)
                            })?,
                        )
                    })
                    .await?;
                let keys = self.0.config.keys.clone();
                let stored = tauri::async_runtime::spawn_blocking(move || keys())
                    .await
                    .map_err(rejected)??;

                Ok(Arc::new(Identity::new(
                    machine_id,
                    self.0.config.label.clone(),
                    &stored,
                )?))
            })
            .await
            .cloned()
    }

    /// Binds the listener on first need and returns its port. A machine that never paired opens no
    /// LAN port at all.
    pub async fn ensure_listening(&self) -> TimetrackResult<u16> {
        let mut listening = self.0.listening.lock().await;

        if let Some(port) = *listening {
            return Ok(port);
        }

        self.identity().await?;

        let listener = TcpListener::bind(self.0.config.bind).await.map_err(|error| {
            rejected(format!(
                "the peer listener could not open {} ({error})",
                self.0.config.bind
            ))
        })?;
        let port = listener.local_addr()?.port();
        let peers = self.clone();

        tokio::spawn(async move {
            let connections = Arc::new(tokio::sync::Semaphore::new(MAX_CONNECTIONS));

            loop {
                let Ok((stream, from)) = listener.accept().await else {
                    continue;
                };
                let Ok(permit) = connections.clone().try_acquire_owned() else {
                    continue;
                };
                let peers = peers.clone();

                tokio::spawn(async move {
                    let _ = tokio::time::timeout(EXCHANGE_TIMEOUT, peers.serve(stream, from)).await;
                    drop(permit);
                });
            }
        });

        *listening = Some(port);

        Ok(port)
    }

    async fn listening_port(&self) -> Option<u16> {
        *self.0.listening.lock().await
    }

    async fn serve(&self, stream: TcpStream, from: SocketAddr) -> TimetrackResult<()> {
        let identity = self.identity().await?;
        let mut tls = TlsAcceptor::from(identity.server.clone()).accept(stream).await?;
        let client_fingerprint = peer_fingerprint(tls.get_ref().1.peer_certificates())?;

        match read_frame(&mut tls).await? {
            Frame::Pair {
                machine_id,
                label,
                port,
                message,
            } => {
                let client = Party {
                    fingerprint: client_fingerprint,
                    machine_id,
                    label,
                    addr: port.map(|port| address(from.ip(), port)),
                };

                self.answer_pair(&mut tls, &identity, client, &message).await
            }
            Frame::Hello {
                machine_id,
                label,
                now_ms: client_now_ms,
                port,
                ..
            } => {
                let client = Party {
                    fingerprint: client_fingerprint,
                    machine_id,
                    label,
                    addr: port.map(|port| address(from.ip(), port)),
                };

                self.answer_hello(&mut tls, &identity, client, client_now_ms).await
            }
            _ => refuse(&mut tls, "expected a pairing or a hello").await,
        }
    }

    /// Takes one attempt at the open offer and returns its code. Every attempt counts, whatever its
    /// outcome, and the attempt that reaches `MAX_ATTEMPTS` closes the offer.
    fn take_attempt(&self) -> Option<String> {
        let mut offer = self.0.offer.lock().ok()?;
        let open = offer.as_mut()?;

        if open.expires_at <= Instant::now() || open.attempts >= MAX_ATTEMPTS {
            *offer = None;

            return None;
        }

        open.attempts += 1;

        let code = open.code.clone();

        if open.attempts >= MAX_ATTEMPTS {
            *offer = None;
        }

        Some(code)
    }

    fn close_offer(&self) {
        if let Ok(mut offer) = self.0.offer.lock() {
            *offer = None;
        }
    }

    async fn answer_pair<S: AsyncRead + AsyncWrite + Unpin>(
        &self,
        tls: &mut S,
        identity: &Identity,
        client: Party,
        inbound: &str,
    ) -> TimetrackResult<()> {
        if client.machine_id == identity.machine_id {
            return refuse(
                tls,
                "both machines have the same machine id: one store is a copy of the other",
            )
            .await;
        }

        let Some(code) = self.take_attempt() else {
            return refuse(tls, "no pairing offer is open on this machine").await;
        };
        let (state, outbound) = start_spake(&code);

        write_frame(
            tls,
            &Frame::Pair {
                machine_id: identity.machine_id.clone(),
                label: identity.label.clone(),
                port: self.listening_port().await,
                message: BASE64.encode(outbound),
            },
        )
        .await?;

        let key = finish_spake(state, inbound);
        let Frame::Confirm { mac } = read_frame(tls).await? else {
            return refuse(tls, "expected a key confirmation").await;
        };
        let transcript = Transcript {
            server_fingerprint: &identity.fingerprint,
            client_fingerprint: &client.fingerprint,
            server_machine_id: &identity.machine_id,
            client_machine_id: &client.machine_id,
            server_label: &identity.label,
            client_label: &client.label,
        };
        let Some(key) = key.filter(|key| transcript.verifies(key, CLIENT_CONFIRM, &mac)) else {
            return refuse(tls, "the pairing failed: a wrong code, or a machine in between").await;
        };
        let confirm = transcript.confirm(&key, SERVER_CONFIRM);

        self.store_pairing(&client).await?;
        self.close_offer();

        write_frame(tls, &Frame::Confirm { mac: confirm }).await?;
        tls.shutdown().await?;

        Ok(())
    }

    async fn answer_hello<S: AsyncRead + AsyncWrite + Unpin>(
        &self,
        tls: &mut S,
        identity: &Identity,
        client: Party,
        client_now_ms: i64,
    ) -> TimetrackResult<()> {
        let fingerprint = client.fingerprint.clone();
        let known = self
            .0
            .db
            .run(move |connection| paired_where(connection, "cert_fingerprint", &fingerprint))
            .await?;

        if !known.is_some_and(|known| known.machine_id == client.machine_id) {
            return refuse(tls, "this machine is not paired with the caller").await;
        }

        let received_ms = now_ms();

        write_frame(
            tls,
            &Frame::Hello {
                machine_id: identity.machine_id.clone(),
                label: identity.label.clone(),
                app_version: self.0.config.app_version.clone(),
                now_ms: received_ms,
                port: self.listening_port().await,
            },
        )
        .await?;

        // The one-way estimate stands if the caller never sends its measured offset.
        let mut offset_ms = client_now_ms - received_ms;

        if let Ok(Ok(Frame::Offset { offset_ms: measured })) =
            tokio::time::timeout(Duration::from_secs(5), read_frame(tls)).await
        {
            offset_ms = -measured;
        }

        self.store_seen(&client, received_ms, offset_ms).await
    }

    async fn store_pairing(&self, peer: &Party) -> TimetrackResult<()> {
        let machine_id = peer.machine_id.clone();
        let label = peer.label.clone();
        let fingerprint = peer.fingerprint.clone();
        let addr = peer.addr.clone();

        self.0
            .db
            .run(move |connection| store_pairing(connection, &machine_id, &label, &fingerprint, addr.as_deref()))
            .await
    }

    async fn store_seen(&self, peer: &Party, at_ms: i64, clock_offset_ms: i64) -> TimetrackResult<()> {
        let machine_id = peer.machine_id.clone();
        let label = peer.label.clone();
        let addr = peer.addr.clone();

        self.0
            .db
            .run(move |connection| {
                store_seen(
                    connection,
                    &Seen {
                        machine_id: &machine_id,
                        label: &label,
                        last_addr: addr.as_deref(),
                        at_ms,
                        clock_offset_ms,
                    },
                )
            })
            .await
    }

    async fn dial(
        &self,
        identity: &Identity,
        host: &str,
        port: u16,
    ) -> TimetrackResult<tokio_rustls::client::TlsStream<TcpStream>> {
        let stream = TcpStream::connect((host, port)).await?;
        let name = ServerName::try_from(TLS_NAME).map_err(rejected)?;

        Ok(TlsConnector::from(identity.client.clone())
            .connect(name, stream)
            .await?)
    }

    pub async fn list(&self) -> TimetrackResult<Vec<PairedMachine>> {
        self.0
            .db
            .run(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {PAIRED_COLUMNS} FROM paired_machine ORDER BY paired_at_ms"
                ))?;
                let rows = statement
                    .query_map([], paired_from_row)?
                    .collect::<Result<Vec<_>, _>>()?;

                Ok(rows)
            })
            .await
    }

    /// Opens a pairing offer with a fresh 6-digit code, replacing any offer still open.
    pub async fn offer(&self) -> TimetrackResult<OpenOffer> {
        let port = self.ensure_listening().await?;
        let code = format!("{:06}", rand::random_range(0..1_000_000u32));
        let expires_at_ms = now_ms() + OFFER_LIFETIME.as_millis() as i64;

        *self.0.offer.lock().map_err(|_| TimetrackError::Poisoned)? = Some(Offer {
            code: code.clone(),
            expires_at: Instant::now() + OFFER_LIFETIME,
            attempts: 0,
        });

        Ok(OpenOffer {
            code,
            port,
            expires_at_ms,
        })
    }

    /// Pairs with the machine at `host:port` that shows `code`, and stores it once both sides have
    /// proven they hold the code over this very connection.
    pub async fn accept(&self, host: &str, port: u16, code: &str) -> TimetrackResult<PairedMachine> {
        tokio::time::timeout(EXCHANGE_TIMEOUT, self.run_accept(host, port, code))
            .await
            .map_err(|_| rejected("the other machine did not finish pairing in time"))?
    }

    async fn run_accept(&self, host: &str, port: u16, code: &str) -> TimetrackResult<PairedMachine> {
        let identity = self.identity().await?;
        let own_port = self.ensure_listening().await.ok();
        let mut tls = self.dial(&identity, host, port).await?;
        let server_fingerprint = peer_fingerprint(tls.get_ref().1.peer_certificates())?;
        let (state, outbound) = start_spake(code.trim());

        write_frame(
            &mut tls,
            &Frame::Pair {
                machine_id: identity.machine_id.clone(),
                label: identity.label.clone(),
                port: own_port,
                message: BASE64.encode(outbound),
            },
        )
        .await?;

        let (machine_id, label, inbound) = match read_frame(&mut tls).await? {
            Frame::Pair {
                machine_id,
                label,
                message,
                ..
            } => (machine_id, label, message),
            Frame::Refused { message } => return Err(rejected(message)),
            _ => return Err(rejected("the other machine answered out of turn")),
        };

        if machine_id == identity.machine_id {
            return Err(rejected(
                "both machines have the same machine id: one store is a copy of the other",
            ));
        }

        let key =
            finish_spake(state, &inbound).ok_or_else(|| rejected("the other machine sent a broken key exchange"))?;
        let transcript = Transcript {
            server_fingerprint: &server_fingerprint,
            client_fingerprint: &identity.fingerprint,
            server_machine_id: &machine_id,
            client_machine_id: &identity.machine_id,
            server_label: &label,
            client_label: &identity.label,
        };

        write_frame(
            &mut tls,
            &Frame::Confirm {
                mac: transcript.confirm(&key, CLIENT_CONFIRM),
            },
        )
        .await?;

        match read_frame(&mut tls).await? {
            Frame::Confirm { mac } if transcript.verifies(&key, SERVER_CONFIRM, &mac) => {}
            Frame::Refused { message } => return Err(rejected(message)),
            _ => return Err(rejected("the pairing failed: a wrong code, or a machine in between")),
        }

        let peer = Party {
            fingerprint: server_fingerprint,
            machine_id: machine_id.clone(),
            label,
            addr: Some(match host.parse::<IpAddr>() {
                Ok(ip) => address(ip, port),
                Err(_) => format!("{host}:{port}"),
            }),
        };

        self.store_pairing(&peer).await?;

        let stored = self
            .0
            .db
            .run(move |connection| paired_where(connection, "machine_id", &machine_id))
            .await?;

        stored.ok_or_else(|| rejected("the pairing was not stored"))
    }

    /// Says hello to a paired machine at the address it was last seen on, and records the clock offset
    /// it measured.
    pub async fn hello(&self, machine_id: &str) -> TimetrackResult<HelloResult> {
        tokio::time::timeout(EXCHANGE_TIMEOUT, self.run_hello(machine_id))
            .await
            .map_err(|_| rejected("the other machine did not answer the hello in time"))?
    }

    async fn run_hello(&self, machine_id: &str) -> TimetrackResult<HelloResult> {
        let identity = self.identity().await?;
        let wanted = machine_id.to_string();
        let peer = self
            .0
            .db
            .run(move |connection| paired_where(connection, "machine_id", &wanted))
            .await?
            .ok_or_else(|| rejected(format!("no paired machine has the id {machine_id}")))?;
        let addr = peer
            .last_addr
            .clone()
            .ok_or_else(|| rejected(format!("{} has no known address", peer.label)))?;
        let (host, port) = split_address(&addr)?;
        let own_port = self.ensure_listening().await.ok();
        let mut tls = self.dial(&identity, &host, port).await?;

        if peer_fingerprint(tls.get_ref().1.peer_certificates())? != peer.cert_fingerprint {
            return Err(rejected(format!(
                "the machine at {addr} is not {}: its certificate changed",
                peer.label
            )));
        }

        let sent_ms = now_ms();

        write_frame(
            &mut tls,
            &Frame::Hello {
                machine_id: identity.machine_id.clone(),
                label: identity.label.clone(),
                app_version: self.0.config.app_version.clone(),
                now_ms: sent_ms,
                port: own_port,
            },
        )
        .await?;

        let (their_id, label, app_version, peer_now_ms) = match read_frame(&mut tls).await? {
            Frame::Hello {
                machine_id,
                label,
                app_version,
                now_ms,
                ..
            } => (machine_id, label, app_version, now_ms),
            Frame::Refused { message } => return Err(rejected(message)),
            _ => return Err(rejected("the other machine answered out of turn")),
        };
        let received_ms = now_ms();

        if their_id != peer.machine_id {
            return Err(rejected(format!("the machine at {addr} answered as another machine")));
        }

        let clock_offset_ms = peer_now_ms - (sent_ms + received_ms) / 2;

        write_frame(
            &mut tls,
            &Frame::Offset {
                offset_ms: clock_offset_ms,
            },
        )
        .await?;
        let _ = tls.shutdown().await;

        self.store_seen(
            &Party {
                fingerprint: peer.cert_fingerprint,
                machine_id: peer.machine_id.clone(),
                label: label.clone(),
                addr: Some(addr),
            },
            received_ms,
            clock_offset_ms,
        )
        .await?;

        Ok(HelloResult {
            machine_id: peer.machine_id,
            label,
            app_version,
            clock_offset_ms,
            round_trip_ms: received_ms - sent_ms,
        })
    }

    pub async fn forget(&self, machine_id: &str) -> TimetrackResult<bool> {
        let machine_id = machine_id.to_string();

        self.0
            .db
            .run(move |connection| {
                Ok(connection.execute("DELETE FROM paired_machine WHERE machine_id = ?1", params![machine_id])? > 0)
            })
            .await
    }

    /// Answers a `peers.*` or `pair.*` agent op. The error is the message the caller is shown.
    pub async fn answer(&self, request: &serde_json::Value) -> Result<serde_json::Value, String> {
        let text = |field: &str| {
            request
                .get(field)
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| format!("{field} is missing"))
        };
        let op = request
            .get("op")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();

        let answered = match op {
            "peers.list" => self.list().await.map(|rows| serde_json::json!(rows)),
            "pair.offer" => self.offer().await.map(|offer| serde_json::json!(offer)),
            "pair.accept" => {
                let host = text("host")?;
                let code = text("code")?;
                let port = request
                    .get("port")
                    .and_then(serde_json::Value::as_u64)
                    .and_then(|port| u16::try_from(port).ok())
                    .unwrap_or(DEFAULT_PORT);

                self.accept(&host, port, &code)
                    .await
                    .map(|peer| serde_json::json!(peer))
            }
            "peers.hello" => self
                .hello(&text("machineId")?)
                .await
                .map(|hello| serde_json::json!(hello)),
            "peers.forget" => self
                .forget(&text("machineId")?)
                .await
                .map(|forgotten| serde_json::json!({ "forgotten": forgotten })),
            _ => return Err(format!("{op} is not an operation")),
        };

        answered.map_err(|error| error.to_string())
    }
}

/// One side of a connection as the other side saw it.
struct Party {
    fingerprint: String,
    machine_id: String,
    label: String,
    addr: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OpenOffer {
    pub code: String,
    pub port: u16,
    pub expires_at_ms: i64,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HelloResult {
    pub machine_id: String,
    pub label: String,
    pub app_version: String,
    pub clock_offset_ms: i64,
    pub round_trip_ms: i64,
}

/// Opens the listener at start when this machine already has a peer to be reached by.
pub fn resume(peers: Peers) {
    tauri::async_runtime::spawn(async move {
        if peers.list().await.is_ok_and(|paired| !paired.is_empty()) {
            let _ = peers.ensure_listening().await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    fn instance(label: &str) -> Peers {
        let connection = Connection::open_in_memory().unwrap();

        crate::db::migrate(&connection).unwrap();

        Peers::new(
            Db::new(connection),
            PeerConfig {
                app_version: "0.0.0-test".to_string(),
                label: label.to_string(),
                bind: SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0),
                keys: Arc::new(generate_key),
            },
        )
    }

    fn attempts(peers: &Peers) -> Option<u32> {
        peers.0.offer.lock().unwrap().as_ref().map(|offer| offer.attempts)
    }

    async fn machine_id(peers: &Peers) -> String {
        peers.identity().await.unwrap().machine_id.clone()
    }

    async fn pair(a: &Peers, b: &Peers) {
        let offer = a.offer().await.unwrap();

        b.accept("127.0.0.1", offer.port, &offer.code).await.unwrap();
    }

    fn wrong(code: &str) -> String {
        format!("{:06}", (code.parse::<u32>().unwrap() + 1) % 1_000_000)
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn the_right_code_pairs_both_sides_with_each_others_certificate() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let (on_a, on_b) = (a.list().await.unwrap(), b.list().await.unwrap());

        assert_eq!(on_a.len(), 1);
        assert_eq!(on_b.len(), 1);
        assert_eq!(on_a[0].machine_id, machine_id(&b).await);
        assert_eq!(on_a[0].label, "laptop");
        assert_eq!(on_a[0].cert_fingerprint, b.identity().await.unwrap().fingerprint);
        assert_eq!(on_b[0].machine_id, machine_id(&a).await);
        assert_eq!(on_b[0].cert_fingerprint, a.identity().await.unwrap().fingerprint);
        assert_eq!(
            on_b[0].last_addr,
            Some(format!("127.0.0.1:{}", a.listening_port().await.unwrap()))
        );
        assert_eq!(
            on_a[0].last_addr,
            Some(format!("127.0.0.1:{}", b.listening_port().await.unwrap()))
        );
        assert_eq!(attempts(&a), None);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_wrong_code_stores_nothing_on_either_side_and_counts_an_attempt() {
        let (a, b) = (instance("pc"), instance("laptop"));
        let offer = a.offer().await.unwrap();

        assert!(b.accept("127.0.0.1", offer.port, &wrong(&offer.code)).await.is_err());
        assert!(a.list().await.unwrap().is_empty());
        assert!(b.list().await.unwrap().is_empty());
        assert_eq!(attempts(&a), Some(1));

        b.accept("127.0.0.1", offer.port, &offer.code).await.unwrap();
        assert_eq!(a.list().await.unwrap().len(), 1);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn the_fifth_attempt_closes_the_offer_even_for_the_right_code_after_it() {
        let (a, b) = (instance("pc"), instance("laptop"));
        let offer = a.offer().await.unwrap();

        for _ in 0..MAX_ATTEMPTS {
            assert!(b.accept("127.0.0.1", offer.port, &wrong(&offer.code)).await.is_err());
        }

        assert_eq!(attempts(&a), None);
        assert!(b.accept("127.0.0.1", offer.port, &offer.code).await.is_err());
        assert!(a.list().await.unwrap().is_empty());
    }

    /// Relays both TLS sessions byte for byte under a certificate of its own, including the right code.
    async fn machine_in_the_middle(target_port: u16) -> u16 {
        let middle = instance("middle");
        let identity = middle.identity().await.unwrap();
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
        let port = listener.local_addr().unwrap().port();

        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut inbound = TlsAcceptor::from(identity.server.clone()).accept(stream).await.unwrap();
            let mut outbound = middle.dial(&identity, "127.0.0.1", target_port).await.unwrap();

            let _ = tokio::io::copy_bidirectional(&mut inbound, &mut outbound).await;
        });

        port
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_in_between_that_relays_the_right_code_fails_the_confirmation() {
        let (a, b) = (instance("pc"), instance("laptop"));
        let offer = a.offer().await.unwrap();
        let middle_port = machine_in_the_middle(offer.port).await;

        assert!(b.accept("127.0.0.1", middle_port, &offer.code).await.is_err());
        assert!(a.list().await.unwrap().is_empty());
        assert!(b.list().await.unwrap().is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn refuses_a_peer_whose_store_is_a_copy_of_this_one() {
        let (a, b) = (instance("pc"), instance("copy"));
        let id = machine_id(&a).await;

        b.0.db
            .run(move |connection| {
                connection.execute("UPDATE machine SET machine_id = ?1", params![id])?;
                Ok(())
            })
            .await
            .unwrap();

        let offer = a.offer().await.unwrap();

        assert!(b.accept("127.0.0.1", offer.port, &offer.code).await.is_err());
        assert!(a.list().await.unwrap().is_empty());
        assert!(b.list().await.unwrap().is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn an_unpaired_certificate_cannot_say_hello() {
        let (a, b) = (instance("pc"), instance("stranger"));
        let port = a.ensure_listening().await.unwrap();
        let a_id = machine_id(&a).await;
        let a_fingerprint = a.identity().await.unwrap().fingerprint.clone();

        b.0.db
            .run(move |connection| {
                store_pairing(
                    connection,
                    &a_id,
                    "pc",
                    &a_fingerprint,
                    Some(&format!("127.0.0.1:{port}")),
                )
            })
            .await
            .unwrap();

        let error = b.hello(&machine_id(&a).await).await.unwrap_err();

        assert!(error.to_string().contains("not paired"), "{error}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn hello_records_last_seen_address_and_clock_offset_on_both_sides() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let started_ms = now_ms();
        let hello = b.hello(&machine_id(&a).await).await.unwrap();

        assert_eq!(hello.label, "pc");
        assert_eq!(hello.app_version, "0.0.0-test");
        assert!(hello.clock_offset_ms.abs() < 1_000);

        let (on_a, on_b) = (&a.list().await.unwrap()[0], &b.list().await.unwrap()[0]);

        for seen in [on_a, on_b] {
            assert!(seen.last_seen_ms.is_some_and(|at| at >= started_ms));
            assert!(seen.clock_offset_ms.is_some_and(|offset| offset.abs() < 1_000));
        }

        assert_eq!(on_b.clock_offset_ms, Some(hello.clock_offset_ms));
        assert_eq!(on_a.clock_offset_ms, Some(-hello.clock_offset_ms));
        assert_eq!(
            on_a.last_addr,
            Some(format!("127.0.0.1:{}", b.listening_port().await.unwrap()))
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_forgotten_machine_is_refused_at_its_next_hello() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        assert!(a.forget(&machine_id(&b).await).await.unwrap());
        assert!(a.list().await.unwrap().is_empty());

        let error = b.hello(&machine_id(&a).await).await.unwrap_err();

        assert!(error.to_string().contains("not paired"), "{error}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn pairing_needs_an_open_offer() {
        let (a, b) = (instance("pc"), instance("laptop"));
        let port = a.ensure_listening().await.unwrap();

        let error = b.accept("127.0.0.1", port, "123456").await.unwrap_err();

        assert!(error.to_string().contains("no pairing offer"), "{error}");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn answers_the_agent_ops_by_name() {
        let (a, b) = (instance("pc"), instance("laptop"));
        let offer = a.answer(&serde_json::json!({ "op": "pair.offer" })).await.unwrap();

        assert_eq!(offer["code"].as_str().unwrap().len(), 6);

        let paired = b
            .answer(&serde_json::json!({
                "op": "pair.accept", "host": "127.0.0.1", "port": offer["port"], "code": offer["code"]
            }))
            .await
            .unwrap();
        let id = paired["machineId"].as_str().unwrap();

        assert_eq!(id, machine_id(&a).await);
        assert_eq!(
            b.answer(&serde_json::json!({ "op": "peers.list" })).await.unwrap()[0]["label"],
            "pc"
        );
        assert!(b
            .answer(&serde_json::json!({ "op": "peers.hello", "machineId": id }))
            .await
            .is_ok());
        assert_eq!(
            b.answer(&serde_json::json!({ "op": "peers.forget", "machineId": id }))
                .await
                .unwrap()["forgotten"],
            true
        );
        assert!(b.answer(&serde_json::json!({ "op": "peers.nope" })).await.is_err());
    }
}
