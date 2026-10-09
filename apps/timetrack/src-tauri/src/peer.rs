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

mod mdns;

pub use mdns::Discovered;

/// The port the LAN listener binds unless `PORT_ENV` names another.
pub const DEFAULT_PORT: u16 = 52741;
pub const PORT_ENV: &str = "TIMETRACK_PEER_PORT";

const OFFER_LIFETIME: Duration = Duration::from_secs(5 * 60);
const MAX_ATTEMPTS: u32 = 5;
const MAX_FRAME_BYTES: usize = 64 * 1024;
const MAX_PAGE_FRAME_BYTES: usize = 4 * 1024 * 1024;
const PAGE_BYTES: usize = 1024 * 1024;
const MAX_PAGE_ROWS: u32 = 500;
/// How far back a machine that holds no day rows from a peer asks for them, whatever their change.
const DAY_ROWS_CATCH_UP_MS: i64 = 30 * 24 * 60 * 60 * 1000;
const EXCHANGE_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_CONNECTIONS: usize = 8;

/// The name the certificate carries and the client asks for. Nothing checks it: a peer is known by
/// its certificate's fingerprint, not by a name a CA vouched for.
const TLS_NAME: &str = "timetrack";
const SPAKE_IDENTITY: &[u8] = b"timetrack-pair-v1";
const CLIENT_CONFIRM: &[u8] = b"timetrack-pair-v1 client";
const SERVER_CONFIRM: &[u8] = b"timetrack-pair-v1 server";
const HEARTBEAT_EVERY: Duration = Duration::from_secs(60);

pub const NO_OFFER: &str = "no pairing offer is open on the other machine: show a code there first";
pub const OFFER_EXPIRED: &str = "the code on the other machine has expired: show a new one";
pub const WRONG_CODE: &str = "the code does not match the one the other machine shows";
const NOT_PAIRED: &str = "this machine is not paired with the caller";

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
    #[serde(rename_all = "camelCase")]
    Pull {
        machine_id: String,
        after_seq: i64,
        limit: u32,
        /// Asks for the day rows of the days that start at or after this, also those changed before
        /// `after_seq`: a machine that predates day rows moved its cursor past them. Absent from such a
        /// machine, and from one that already holds the peer's rows.
        #[serde(default)]
        day_rows_from_ms: Option<i64>,
    },
    #[serde(rename_all = "camelCase")]
    Changes {
        events: Vec<PeerEvent>,
        deleted: Vec<i64>,
        cursor: i64,
        more: bool,
        /// Absent from a peer that predates the map, which then keeps the map stored for it.
        #[serde(default)]
        repo_keys: Option<Vec<RepoKey>>,
        /// The serving machine's day rows changed in this page. Absent from a peer that predates them.
        #[serde(default)]
        day_rows: Option<Vec<DayRows>>,
    },
}

/// A machine's reviewed rows of one day, as the core wrote them.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DayRows {
    pub day: String,
    pub day_start_ms: i64,
    pub rows: String,
}

/// A checkout path and its `repoKeyOf` key.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RepoKey {
    pub path: String,
    pub key: String,
}

/// One of the serving machine's own `collected_event` rows, as it stands at `changed_seq`.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PeerEvent {
    row_id: i64,
    at_ms: i64,
    source: String,
    kind: String,
    payload: String,
    dedupe_key: Option<String>,
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
    read_frame_up_to(stream, MAX_FRAME_BYTES).await
}

async fn read_frame_up_to<S: AsyncRead + Unpin>(stream: &mut S, max_bytes: usize) -> TimetrackResult<Frame> {
    let mut length = [0u8; 4];

    stream.read_exact(&mut length).await?;

    let length = u32::from_be_bytes(length) as usize;

    if length > max_bytes {
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
    pub last_pull_ms: Option<i64>,
}

const PAIRED_COLUMNS: &str =
    "machine_id, COALESCE(name, label), cert_fingerprint, last_addr, last_seen_ms, clock_offset_ms, paired_at_ms, last_pull_ms";

fn paired_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PairedMachine> {
    Ok(PairedMachine {
        machine_id: row.get(0)?,
        label: row.get(1)?,
        cert_fingerprint: row.get(2)?,
        last_addr: row.get(3)?,
        last_seen_ms: row.get(4)?,
        clock_offset_ms: row.get(5)?,
        paired_at_ms: row.get(6)?,
        last_pull_ms: row.get(7)?,
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

/// The changes after `after_seq` among this machine's own events, oldest first, as one frame that
/// stays within `PAGE_BYTES` unless its first row alone is larger. `received_event` is never read:
/// a machine serves only what it collected (ADR 0039). With `day_rows_from_ms` the frame also carries the
/// day rows of the days from there on that changed at or before `after_seq`.
fn changes_after(
    connection: &Connection,
    after_seq: i64,
    limit: u32,
    day_rows_from_ms: Option<i64>,
) -> TimetrackResult<Frame> {
    let limit = limit.clamp(1, MAX_PAGE_ROWS);
    let mut statement = connection.prepare(
        "SELECT changed_seq, id, at_ms, source, kind, payload, dedupe_key, 0 FROM collected_event
           WHERE changed_seq > ?1
         UNION ALL
         SELECT changed_seq, row_id, at_ms, '', '', '', NULL, 1 FROM deleted_event WHERE changed_seq > ?1
         UNION ALL
         SELECT changed_seq, 0, day_start_ms, day, '', rows, NULL, 2 FROM day_rows WHERE changed_seq > ?1
         ORDER BY 1
         LIMIT ?2",
    )?;
    let mut rows = statement.query(params![after_seq, i64::from(limit) + 1])?;
    let (mut events, mut deleted) = (Vec::new(), Vec::new());
    let mut day_rows = match day_rows_from_ms {
        Some(from_ms) => day_rows_through(connection, after_seq, from_ms)?,
        None => Vec::new(),
    };
    let (mut cursor, mut bytes, mut taken, mut more) = (after_seq, 0usize, 0u32, false);

    while let Some(row) = rows.next()? {
        if taken == limit || (taken > 0 && bytes >= PAGE_BYTES) {
            more = true;

            break;
        }

        let seq: i64 = row.get(0)?;

        let flag: i64 = row.get(7)?;

        if flag == 1 {
            deleted.push(row.get(1)?);
            bytes += 24;
        } else if flag == 2 {
            let rows = DayRows {
                day: row.get(3)?,
                day_start_ms: row.get(2)?,
                rows: row.get(5)?,
            };

            bytes += serde_json::to_vec(&rows)?.len() + 1;
            day_rows.push(rows);
        } else {
            let event = PeerEvent {
                row_id: row.get(1)?,
                at_ms: row.get(2)?,
                source: row.get(3)?,
                kind: row.get(4)?,
                payload: row.get(5)?,
                dedupe_key: row.get(6)?,
            };

            bytes += serde_json::to_vec(&event)?.len() + 1;
            events.push(event);
        }

        cursor = seq;
        taken += 1;
    }

    Ok(Frame::Changes {
        events,
        deleted,
        cursor,
        more,
        repo_keys: Some(own_repo_keys(connection)?),
        day_rows: Some(day_rows),
    })
}

fn day_rows_through(connection: &Connection, through_seq: i64, from_ms: i64) -> TimetrackResult<Vec<DayRows>> {
    let mut statement = connection.prepare(
        "SELECT day, day_start_ms, rows FROM day_rows
          WHERE changed_seq <= ?1 AND day_start_ms >= ?2
          ORDER BY day_start_ms",
    )?;
    let rows = statement.query_map(params![through_seq, from_ms], |row| {
        Ok(DayRows {
            day: row.get(0)?,
            day_start_ms: row.get(1)?,
            rows: row.get(2)?,
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// This machine's own day rows of the days that start at or after `from_ms`.
fn own_day_rows_from(connection: &Connection, from_ms: i64) -> TimetrackResult<Vec<DayRows>> {
    day_rows_through(connection, i64::MAX, from_ms)
}

/// Where to ask a peer for its day rows outside the cursor: from `DAY_ROWS_CATCH_UP_MS` ago while this
/// machine holds none of them, else nowhere.
fn day_rows_catch_up_from(connection: &Connection, machine_id: &str, now_ms: i64) -> TimetrackResult<Option<i64>> {
    let held = connection
        .query_row(
            "SELECT 1 FROM received_day_rows WHERE machine_id = ?1 LIMIT 1",
            params![machine_id],
            |_| Ok(()),
        )
        .optional()?;

    Ok(held.is_none().then(|| now_ms - DAY_ROWS_CATCH_UP_MS))
}

/// Replaces this machine's rows of a day. Unchanged rows keep their change, so no pull resends them.
fn store_day_rows(connection: &Connection, rows: &DayRows) -> TimetrackResult<()> {
    connection.execute(
        "INSERT INTO day_rows (day, day_start_ms, rows) VALUES (?1, ?2, ?3)
         ON CONFLICT (day) DO UPDATE SET day_start_ms = ?2, rows = ?3
           WHERE day_start_ms <> ?2 OR rows <> ?3",
        params![rows.day, rows.day_start_ms, rows.rows],
    )?;

    Ok(())
}

fn own_repo_keys(connection: &Connection) -> TimetrackResult<Vec<RepoKey>> {
    let mut statement = connection.prepare("SELECT path, key FROM repo_key ORDER BY path")?;
    let rows = statement.query_map([], |row| {
        Ok(RepoKey {
            path: row.get(0)?,
            key: row.get(1)?,
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn store_repo_keys(connection: &mut Connection, keys: &[RepoKey]) -> TimetrackResult<()> {
    let transaction = connection.transaction()?;

    transaction.execute("DELETE FROM repo_key", [])?;

    for entry in keys {
        transaction.execute(
            "INSERT OR REPLACE INTO repo_key (path, key) VALUES (?1, ?2)",
            params![entry.path, entry.key],
        )?;
    }

    transaction.commit()?;

    Ok(())
}

/// A paired machine's checkout path and its key, as that machine last sent them.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PeerRepoKey {
    pub machine_id: String,
    pub path: String,
    pub key: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReceivedRange {
    pub events: Vec<ReceivedEvent>,
    pub repo_keys: Vec<PeerRepoKey>,
    pub own_repo_keys: Vec<RepoKey>,
    pub day_rows: Vec<ReceivedDayRows>,
}

/// The last rows of a day a paired machine sent.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReceivedDayRows {
    pub machine_id: String,
    pub day: String,
    pub rows: String,
}

/// The day rows of the days that start in `[from_ms, to_ms)`. A forgotten machine's are left out.
fn received_day_rows_in(connection: &Connection, from_ms: i64, to_ms: i64) -> TimetrackResult<Vec<ReceivedDayRows>> {
    let mut statement = connection.prepare(
        "SELECT received.machine_id, received.day, received.rows
           FROM received_day_rows received
           JOIN paired_machine paired ON paired.machine_id = received.machine_id
          WHERE received.day_start_ms >= ?1 AND received.day_start_ms < ?2
          ORDER BY received.day, received.machine_id",
    )?;
    let rows = statement.query_map(params![from_ms, to_ms], |row| {
        Ok(ReceivedDayRows {
            machine_id: row.get(0)?,
            day: row.get(1)?,
            rows: row.get(2)?,
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReceivedEvent {
    pub machine_id: String,
    pub label: String,
    pub at_ms: i64,
    pub source: String,
    pub kind: String,
    pub payload: serde_json::Value,
}

/// The copies of a forgotten machine stay in the store until retention takes them, and are left out.
fn received_in(connection: &Connection, from_ms: i64, to_ms: i64) -> TimetrackResult<Vec<ReceivedEvent>> {
    let mut statement = connection.prepare(
        "SELECT received.machine_id, COALESCE(paired.name, paired.label), received.at_ms, received.source, received.kind, received.payload
           FROM received_event received
           JOIN paired_machine paired ON paired.machine_id = received.machine_id
          WHERE received.at_ms >= ?1 AND received.at_ms < ?2
          ORDER BY received.at_ms, received.machine_id, received.peer_row_id",
    )?;
    let rows = statement.query_map(params![from_ms, to_ms], |row| {
        Ok(ReceivedEvent {
            machine_id: row.get(0)?,
            label: row.get(1)?,
            at_ms: row.get(2)?,
            source: row.get(3)?,
            kind: row.get(4)?,
            payload: serde_json::from_str(&row.get::<_, String>(5)?).unwrap_or(serde_json::Value::Null),
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn peer_repo_keys(connection: &Connection) -> TimetrackResult<Vec<PeerRepoKey>> {
    let mut statement = connection.prepare(
        "SELECT keys.machine_id, keys.path, keys.key
           FROM peer_repo_key keys
           JOIN paired_machine paired ON paired.machine_id = keys.machine_id
          ORDER BY keys.machine_id, keys.path",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(PeerRepoKey {
            machine_id: row.get(0)?,
            path: row.get(1)?,
            key: row.get(2)?,
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn cursor_of(connection: &Connection, machine_id: &str) -> TimetrackResult<i64> {
    Ok(connection
        .query_row(
            "SELECT changed_seq FROM peer_cursor WHERE machine_id = ?1",
            params![machine_id],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(0))
}

/// Applies one page of a peer's changes and moves its cursor, all or nothing.
///
/// A peer's `dedupe_key` is unique among its own rows, so a received row of the same machine that
/// still holds an incoming row's key is a copy the peer has since deleted or re-keyed and whose
/// tombstone this machine never saw (retention dropped it). The incoming row replaces it.
fn apply_changes(
    connection: &mut Connection,
    machine_id: &str,
    events: &[PeerEvent],
    deleted: &[i64],
    cursor: i64,
    repo_keys: Option<&[RepoKey]>,
    day_rows: &[DayRows],
) -> TimetrackResult<(usize, usize)> {
    let transaction = connection.transaction()?;
    let mut removed = 0;

    if let Some(keys) = repo_keys {
        transaction.execute("DELETE FROM peer_repo_key WHERE machine_id = ?1", params![machine_id])?;

        for entry in keys {
            transaction.execute(
                "INSERT OR REPLACE INTO peer_repo_key (machine_id, path, key) VALUES (?1, ?2, ?3)",
                params![machine_id, entry.path, entry.key],
            )?;
        }
    }

    for event in events {
        if let Some(key) = &event.dedupe_key {
            removed += transaction.execute(
                "DELETE FROM received_event WHERE machine_id = ?1 AND dedupe_key = ?2 AND peer_row_id <> ?3",
                params![machine_id, key, event.row_id],
            )?;
        }

        transaction.execute(
            "INSERT INTO received_event (machine_id, peer_row_id, at_ms, source, kind, payload, dedupe_key)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT (machine_id, peer_row_id) DO UPDATE SET
               at_ms = ?3, source = ?4, kind = ?5, payload = ?6, dedupe_key = ?7",
            params![
                machine_id,
                event.row_id,
                event.at_ms,
                event.source,
                event.kind,
                event.payload,
                event.dedupe_key
            ],
        )?;
    }

    for rows in day_rows {
        transaction.execute(
            "INSERT INTO received_day_rows (machine_id, day, day_start_ms, rows) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (machine_id, day) DO UPDATE SET day_start_ms = ?3, rows = ?4",
            params![machine_id, rows.day, rows.day_start_ms, rows.rows],
        )?;
    }

    for row_id in deleted {
        removed += transaction.execute(
            "DELETE FROM received_event WHERE machine_id = ?1 AND peer_row_id = ?2",
            params![machine_id, row_id],
        )?;
    }

    transaction.execute(
        "INSERT INTO peer_cursor (machine_id, changed_seq) VALUES (?1, ?2)
         ON CONFLICT (machine_id) DO UPDATE SET changed_seq = MAX(changed_seq, ?2)",
        params![machine_id, cursor],
    )?;
    transaction.execute(
        "UPDATE paired_machine SET last_pull_ms = ?2 WHERE machine_id = ?1",
        params![machine_id, now_ms()],
    )?;
    transaction.commit()?;

    Ok((events.len(), removed))
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
    pub mdns: bool,
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
            mdns: true,
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
    discovery: Mutex<Option<mdns::Discovery>>,
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
            discovery: Mutex::new(None),
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

        let _ = self.discover(Some(port)).await;

        Ok(port)
    }

    /// Starts browsing for other machines and, given the listener's port, advertises this one. Browsing
    /// also starts on a machine with no listener, so one that never paired can find an offer without
    /// opening a LAN port.
    async fn discover(&self, advertise: Option<u16>) -> TimetrackResult<Arc<Mutex<mdns::Directory>>> {
        if !self.0.config.mdns {
            return Err(rejected("discovery is off"));
        }

        let identity = self.identity().await?;
        let mut discovery = self.0.discovery.lock().map_err(|_| TimetrackError::Poisoned)?;

        if discovery.is_none() {
            *discovery = Some(mdns::Discovery::start(&identity, self.0.db.clone())?);
        }

        let running = discovery.as_mut().expect("discovery was just started");

        if let Some(port) = advertise {
            running.advertise(&identity, port)?;
        }

        Ok(running.directory.clone())
    }

    /// The machines advertising on the LAN right now, other than this one.
    pub async fn discovered(&self) -> TimetrackResult<Vec<Discovered>> {
        let directory = self.discover(None).await?;
        let paired = self.list().await?;
        let found = directory.lock().map_err(|_| TimetrackError::Poisoned)?.list();

        Ok(found.iter().map(|found| found.describe(&paired)).collect())
    }

    async fn locate(&self, machine_id: &str) -> TimetrackResult<(String, u16)> {
        let directory = self.discover(None).await?;
        let found = directory
            .lock()
            .map_err(|_| TimetrackError::Poisoned)?
            .get(machine_id)
            .cloned()
            .ok_or_else(|| {
                rejected("that machine is no longer seen on the network: pick it again, or enter its address")
            })?;

        Ok((found.addresses[0].to_string(), found.port))
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
            Frame::Pull {
                machine_id,
                after_seq,
                limit,
                day_rows_from_ms,
            } => {
                let client = Party {
                    fingerprint: client_fingerprint,
                    machine_id,
                    label: String::new(),
                    addr: None,
                };

                self.answer_pull(&mut tls, &client, after_seq, limit, day_rows_from_ms)
                    .await
            }
            _ => refuse(&mut tls, "expected a pairing, a hello or a pull").await,
        }
    }

    /// Takes one attempt at the open offer and returns its code, or why there is none to try. Every
    /// attempt counts, whatever its outcome, and the attempt that reaches `MAX_ATTEMPTS` closes the
    /// offer.
    fn take_attempt(&self) -> Result<String, &'static str> {
        let mut offer = self.0.offer.lock().map_err(|_| NO_OFFER)?;
        let open = offer.as_mut().ok_or(NO_OFFER)?;

        if open.expires_at <= Instant::now() || open.attempts >= MAX_ATTEMPTS {
            *offer = None;

            return Err(OFFER_EXPIRED);
        }

        open.attempts += 1;

        let code = open.code.clone();

        if open.attempts >= MAX_ATTEMPTS {
            *offer = None;
        }

        Ok(code)
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

        let code = match self.take_attempt() {
            Ok(code) => code,
            Err(reason) => return refuse(tls, reason).await,
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
            return refuse(tls, WRONG_CODE).await;
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
        if !self.is_paired(&client).await? {
            return refuse(tls, NOT_PAIRED).await;
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

    async fn is_paired(&self, client: &Party) -> TimetrackResult<bool> {
        let fingerprint = client.fingerprint.clone();
        let known = self
            .0
            .db
            .run(move |connection| paired_where(connection, "cert_fingerprint", &fingerprint))
            .await?;

        Ok(known.is_some_and(|known| known.machine_id == client.machine_id))
    }

    async fn answer_pull<S: AsyncRead + AsyncWrite + Unpin>(
        &self,
        tls: &mut S,
        client: &Party,
        after_seq: i64,
        limit: u32,
        day_rows_from_ms: Option<i64>,
    ) -> TimetrackResult<()> {
        if !self.is_paired(client).await? {
            return refuse(tls, NOT_PAIRED).await;
        }

        let page = self
            .0
            .db
            .run(move |connection| changes_after(connection, after_seq, limit, day_rows_from_ms))
            .await?;

        if serde_json::to_vec(&page)?.len() > MAX_PAGE_FRAME_BYTES {
            return refuse(tls, "an event is too large to send").await;
        }

        write_frame(tls, &page).await?;
        tls.shutdown().await?;

        Ok(())
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
        let stream = TcpStream::connect((host, port))
            .await
            .map_err(|error| rejected(format!("nothing answered at {host}:{port} ({error})")))?;
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
            _ => return Err(rejected(WRONG_CODE)),
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

    /// Pairs with a discovered machine, or with the one at an address the user typed.
    pub async fn pair_with(&self, target: PairTarget, code: &str) -> TimetrackResult<PairedMachine> {
        let (host, port) = match target {
            PairTarget::Discovered { machine_id } => self.locate(&machine_id).await?,
            PairTarget::Address { host, port } => (host, port.unwrap_or(DEFAULT_PORT)),
        };

        self.accept(&host, port, code).await
    }

    /// Says hello to a paired machine at the address it was last seen on, and records the clock offset
    /// it measured.
    pub async fn hello(&self, machine_id: &str) -> TimetrackResult<HelloResult> {
        tokio::time::timeout(EXCHANGE_TIMEOUT, self.run_hello(machine_id))
            .await
            .map_err(|_| rejected("the other machine did not answer the hello in time"))?
    }

    async fn connect_paired(
        &self,
        machine_id: &str,
    ) -> TimetrackResult<(
        Arc<Identity>,
        PairedMachine,
        String,
        tokio_rustls::client::TlsStream<TcpStream>,
    )> {
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
        let _ = self.ensure_listening().await;
        let tls = self.dial(&identity, &host, port).await?;

        if peer_fingerprint(tls.get_ref().1.peer_certificates())? != peer.cert_fingerprint {
            return Err(rejected(format!(
                "the machine at {addr} is not {}: its certificate changed",
                peer.label
            )));
        }

        Ok((identity, peer, addr, tls))
    }

    async fn run_hello(&self, machine_id: &str) -> TimetrackResult<HelloResult> {
        let (identity, peer, addr, mut tls) = self.connect_paired(machine_id).await?;
        let own_port = self.listening_port().await;
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

    /// Copies the events a paired machine collected since the last pull into `received_event`, page by
    /// page, and applies the deletions it reports.
    pub async fn pull(&self, machine_id: &str) -> TimetrackResult<PullResult> {
        self.pull_in_pages(machine_id, MAX_PAGE_ROWS).await
    }

    async fn pull_in_pages(&self, machine_id: &str, limit: u32) -> TimetrackResult<PullResult> {
        let mut result = PullResult {
            machine_id: machine_id.to_string(),
            upserted: 0,
            deleted: 0,
            cursor: 0,
        };

        loop {
            let (upserted, deleted, cursor, more) =
                tokio::time::timeout(EXCHANGE_TIMEOUT, self.pull_page(machine_id, limit))
                    .await
                    .map_err(|_| rejected("the other machine did not answer the pull in time"))??;

            result.upserted += upserted;
            result.deleted += deleted;
            result.cursor = cursor;

            if !more {
                return Ok(result);
            }
        }
    }

    async fn pull_page(&self, machine_id: &str, limit: u32) -> TimetrackResult<(usize, usize, i64, bool)> {
        let wanted = machine_id.to_string();
        let (after_seq, day_rows_from_ms) = self
            .0
            .db
            .run(move |connection| {
                Ok((
                    cursor_of(connection, &wanted)?,
                    day_rows_catch_up_from(connection, &wanted, now_ms())?,
                ))
            })
            .await?;
        let (identity, peer, _, mut tls) = self.connect_paired(machine_id).await?;

        write_frame(
            &mut tls,
            &Frame::Pull {
                machine_id: identity.machine_id.clone(),
                after_seq,
                limit,
                day_rows_from_ms,
            },
        )
        .await?;

        let (events, deleted, cursor, more, repo_keys, day_rows) =
            match read_frame_up_to(&mut tls, MAX_PAGE_FRAME_BYTES).await? {
                Frame::Changes {
                    events,
                    deleted,
                    cursor,
                    more,
                    repo_keys,
                    day_rows,
                } => (events, deleted, cursor, more, repo_keys, day_rows.unwrap_or_default()),
                Frame::Refused { message } => return Err(rejected(message)),
                _ => return Err(rejected("the other machine answered out of turn")),
            };
        let _ = tls.shutdown().await;

        if cursor < after_seq {
            return Err(rejected(format!(
                "{} answered with a change cursor before this machine's",
                peer.label
            )));
        }

        let (upserted, removed) = self
            .0
            .db
            .run(move |connection| {
                apply_changes(
                    connection,
                    &peer.machine_id,
                    &events,
                    &deleted,
                    cursor,
                    repo_keys.as_deref(),
                    &day_rows,
                )
            })
            .await?;

        Ok((upserted, removed, cursor, more))
    }

    pub async fn received_between(&self, from_ms: i64, to_ms: i64) -> TimetrackResult<ReceivedRange> {
        self.0
            .db
            .run(move |connection| {
                Ok(ReceivedRange {
                    events: received_in(connection, from_ms, to_ms)?,
                    repo_keys: peer_repo_keys(connection)?,
                    own_repo_keys: own_repo_keys(connection)?,
                    day_rows: received_day_rows_in(connection, from_ms, to_ms)?,
                })
            })
            .await
    }

    /// Replaces this machine's map from checkout path to repository key, which every pull sends along.
    pub async fn set_repo_keys(&self, keys: Vec<RepoKey>) -> TimetrackResult<()> {
        self.0
            .db
            .run(move |connection| store_repo_keys(connection, &keys))
            .await
    }

    /// Replaces this machine's rows of a day, which the next pull from here carries to the paired machine.
    pub async fn set_day_rows(&self, rows: DayRows) -> TimetrackResult<()> {
        self.0.db.run(move |connection| store_day_rows(connection, &rows)).await
    }

    /// This machine's own rows of the days that start at or after `from_ms`, as it last stored them.
    pub async fn own_day_rows(&self, from_ms: i64) -> TimetrackResult<Vec<DayRows>> {
        self.0
            .db
            .run(move |connection| own_day_rows_from(connection, from_ms))
            .await
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

    /// Withdraws this machine's mDNS advertisement and stops browsing.
    /// An empty name clears the user's name, so the machine reads under its host name again.
    pub async fn rename(&self, machine_id: &str, name: &str) -> TimetrackResult<bool> {
        let machine_id = machine_id.to_string();
        let name = Some(name.trim().to_string()).filter(|name| !name.is_empty());

        self.0
            .db
            .run(move |connection| {
                Ok(connection.execute(
                    "UPDATE paired_machine SET name = ?2 WHERE machine_id = ?1",
                    params![machine_id, name],
                )? > 0)
            })
            .await
    }

    pub fn shutdown(&self) {
        let running = self.0.discovery.lock().ok().and_then(|mut discovery| discovery.take());

        drop(running);
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
            "peers.discovered" => self.discovered().await.map(|rows| serde_json::json!(rows)),
            "pair.accept" => {
                let code = text("code")?;
                let target = match text("machineId") {
                    Ok(machine_id) => PairTarget::Discovered { machine_id },
                    Err(_) => PairTarget::Address {
                        host: text("host")?,
                        port: request
                            .get("port")
                            .and_then(serde_json::Value::as_u64)
                            .and_then(|port| u16::try_from(port).ok()),
                    },
                };

                self.pair_with(target, &code).await.map(|peer| serde_json::json!(peer))
            }
            "peers.hello" => self
                .hello(&text("machineId")?)
                .await
                .map(|hello| serde_json::json!(hello)),
            "peers.pull" => self
                .pull(&text("machineId")?)
                .await
                .map(|pulled| serde_json::json!(pulled)),
            "peers.received" => {
                let ms = |field: &str| {
                    request
                        .get(field)
                        .and_then(serde_json::Value::as_i64)
                        .ok_or_else(|| format!("{field} is missing"))
                };

                self.received_between(ms("fromMs")?, ms("toMs")?)
                    .await
                    .map(|events| serde_json::json!(events))
            }
            "peers.forget" => self
                .forget(&text("machineId")?)
                .await
                .map(|forgotten| serde_json::json!({ "forgotten": forgotten })),
            "peers.rename" => self
                .rename(&text("machineId")?, &text("name")?)
                .await
                .map(|renamed| serde_json::json!({ "renamed": renamed })),
            _ => return Err(format!("{op} is not an operation")),
        };

        answered.map_err(|error| error.to_string())
    }
}

#[derive(Deserialize, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PairTarget {
    #[serde(rename_all = "camelCase")]
    Discovered { machine_id: String },
    #[serde(rename_all = "camelCase")]
    Address { host: String, port: Option<u16> },
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

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PullResult {
    pub machine_id: String,
    pub upserted: usize,
    pub deleted: usize,
    pub cursor: i64,
}

/// Opens the listener at start when this machine already has a peer to be reached by.
pub fn resume(peers: Peers) {
    tauri::async_runtime::spawn(async move {
        if peers.list().await.is_ok_and(|paired| !paired.is_empty()) {
            let _ = peers.ensure_listening().await;
        }
    });
}

/// Says hello to every paired machine once a `HEARTBEAT_EVERY`, which keeps last-seen and the clock
/// offset current on both sides, and pulls the events of each one that answered. A machine that does
/// not answer is skipped until the next round.
pub fn heartbeat(peers: Peers) {
    tauri::async_runtime::spawn(async move {
        let mut every = tokio::time::interval(HEARTBEAT_EVERY);

        every.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            every.tick().await;

            for machine in peers.list().await.unwrap_or_default() {
                if peers.hello(&machine.machine_id).await.is_ok() {
                    let _ = peers.pull(&machine.machine_id).await;
                }
            }
        }
    });
}

#[tauri::command]
pub async fn peers_list(peers: tauri::State<'_, Peers>) -> TimetrackResult<Vec<PairedMachine>> {
    peers.list().await
}

#[tauri::command]
pub async fn peers_discovered(peers: tauri::State<'_, Peers>) -> TimetrackResult<Vec<Discovered>> {
    peers.discovered().await
}

#[tauri::command]
pub async fn pair_offer(peers: tauri::State<'_, Peers>) -> TimetrackResult<OpenOffer> {
    peers.offer().await
}

#[tauri::command]
pub async fn pair_accept(
    peers: tauri::State<'_, Peers>,
    target: PairTarget,
    code: String,
) -> TimetrackResult<PairedMachine> {
    peers.pair_with(target, &code).await
}

#[tauri::command]
pub async fn peers_hello(peers: tauri::State<'_, Peers>, machine_id: String) -> TimetrackResult<HelloResult> {
    peers.hello(&machine_id).await
}

#[tauri::command]
pub async fn peers_pull(peers: tauri::State<'_, Peers>, machine_id: String) -> TimetrackResult<PullResult> {
    peers.pull(&machine_id).await
}

#[tauri::command]
pub async fn received_between(
    peers: tauri::State<'_, Peers>,
    from_ms: i64,
    to_ms: i64,
) -> TimetrackResult<ReceivedRange> {
    peers.received_between(from_ms, to_ms).await
}

#[tauri::command]
pub async fn set_repo_keys(peers: tauri::State<'_, Peers>, keys: Vec<RepoKey>) -> TimetrackResult<()> {
    peers.set_repo_keys(keys).await
}

#[tauri::command]
pub async fn set_day_rows(peers: tauri::State<'_, Peers>, rows: DayRows) -> TimetrackResult<()> {
    peers.set_day_rows(rows).await
}

#[tauri::command]
pub async fn own_day_rows(peers: tauri::State<'_, Peers>, from_ms: i64) -> TimetrackResult<Vec<DayRows>> {
    peers.own_day_rows(from_ms).await
}

#[tauri::command]
pub async fn peers_forget(peers: tauri::State<'_, Peers>, machine_id: String) -> TimetrackResult<bool> {
    peers.forget(&machine_id).await
}

#[tauri::command]
pub async fn peers_rename(peers: tauri::State<'_, Peers>, machine_id: String, name: String) -> TimetrackResult<bool> {
    peers.rename(&machine_id, &name).await
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
                mdns: false,
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

        let error = b
            .accept("127.0.0.1", offer.port, &wrong(&offer.code))
            .await
            .unwrap_err();

        assert_eq!(error.to_string(), WRONG_CODE);
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
    async fn an_expired_offer_says_so_rather_than_that_none_is_open() {
        let (a, b) = (instance("pc"), instance("laptop"));
        let offer = a.offer().await.unwrap();

        a.0.offer.lock().unwrap().as_mut().unwrap().expires_at = Instant::now() - Duration::from_secs(1);

        let error = b.accept("127.0.0.1", offer.port, &offer.code).await.unwrap_err();

        assert_eq!(error.to_string(), OFFER_EXPIRED);
        assert!(a.list().await.unwrap().is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_that_is_not_there_is_named_by_its_address() {
        let b = instance("laptop");
        let closed = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
        let port = closed.local_addr().unwrap().port();

        drop(closed);

        let error = b
            .pair_with(
                PairTarget::Address {
                    host: "127.0.0.1".to_string(),
                    port: Some(port),
                },
                "123456",
            )
            .await
            .unwrap_err();

        assert!(
            error
                .to_string()
                .starts_with(&format!("nothing answered at 127.0.0.1:{port}")),
            "{error}"
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn pairing_needs_an_open_offer() {
        let (a, b) = (instance("pc"), instance("laptop"));
        let port = a.ensure_listening().await.unwrap();

        let error = b.accept("127.0.0.1", port, "123456").await.unwrap_err();

        assert!(error.to_string().contains("no pairing offer"), "{error}");
    }

    async fn collect(peers: &Peers, at_ms: i64, dedupe_key: Option<&str>) -> i64 {
        let dedupe_key = dedupe_key.map(str::to_string);

        peers
            .0
            .db
            .run(move |connection| {
                connection.execute(
                    "INSERT INTO collected_event (at_ms, source, kind, payload, dedupe_key)
                     VALUES (?1, 'git', 'git-commit', '{}', ?2)",
                    params![at_ms, dedupe_key],
                )?;

                Ok(connection.last_insert_rowid())
            })
            .await
            .unwrap()
    }

    async fn execute(peers: &Peers, sql: &'static str) {
        peers
            .0
            .db
            .run(move |connection| {
                connection.execute_batch(sql)?;
                Ok(())
            })
            .await
            .unwrap();
    }

    async fn received(peers: &Peers) -> Vec<(String, i64, i64, Option<String>)> {
        peers
            .0
            .db
            .run(|connection| {
                let mut statement = connection.prepare(
                    "SELECT machine_id, peer_row_id, at_ms, dedupe_key FROM received_event
                     ORDER BY machine_id, peer_row_id",
                )?;
                let rows = statement
                    .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?
                    .collect::<Result<Vec<_>, _>>()?;

                Ok(rows)
            })
            .await
            .unwrap()
    }

    async fn cursor(peers: &Peers, machine_id: String) -> i64 {
        peers
            .0
            .db
            .run(move |connection| cursor_of(connection, &machine_id))
            .await
            .unwrap()
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_pull_copies_every_event_then_only_the_new_ones() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;
        let first = collect(&a, 1_000, Some("one")).await;
        let second = collect(&a, 2_000, None).await;

        let pulled = b.pull(&a_id).await.unwrap();

        assert_eq!((pulled.upserted, pulled.deleted), (2, 0));
        assert_eq!(
            received(&b).await,
            vec![
                (a_id.clone(), first, 1_000, Some("one".to_string())),
                (a_id.clone(), second, 2_000, None)
            ]
        );
        assert_eq!(cursor(&b, a_id.clone()).await, pulled.cursor);

        let third = collect(&a, 3_000, Some("three")).await;
        let again = b.pull(&a_id).await.unwrap();

        assert_eq!((again.upserted, again.deleted), (1, 0));
        assert!(again.cursor > pulled.cursor);
        assert_eq!(received(&b).await.len(), 3);
        assert_eq!(
            received(&b).await[2],
            (a_id.clone(), third, 3_000, Some("three".to_string()))
        );
        assert_eq!(b.pull(&a_id).await.unwrap().upserted, 0);
    }

    fn day_rows(day: &str, day_start_ms: i64, rows: &str) -> DayRows {
        DayRows {
            day: day.to_string(),
            day_start_ms,
            rows: rows.to_string(),
        }
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_pull_carries_the_last_rows_each_day_was_sent_with() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;
        let rows_in = |range: ReceivedRange| {
            range
                .day_rows
                .into_iter()
                .map(|rows| (rows.machine_id, rows.day, rows.rows))
                .collect::<Vec<_>>()
        };

        a.set_day_rows(day_rows("2026-10-08", 1_000, "first")).await.unwrap();
        a.set_day_rows(day_rows("2026-10-09", 5_000, "other")).await.unwrap();
        b.pull(&a_id).await.unwrap();

        assert_eq!(
            rows_in(b.received_between(0, 2_000).await.unwrap()),
            vec![(a_id.clone(), "2026-10-08".to_string(), "first".to_string())]
        );

        a.set_day_rows(day_rows("2026-10-08", 1_000, "second")).await.unwrap();
        let changed = b.pull(&a_id).await.unwrap();

        assert_eq!(
            rows_in(b.received_between(0, 2_000).await.unwrap()),
            vec![(a_id.clone(), "2026-10-08".to_string(), "second".to_string())]
        );

        a.set_day_rows(day_rows("2026-10-08", 1_000, "second")).await.unwrap();

        assert_eq!(b.pull(&a_id).await.unwrap().cursor, changed.cursor);
        assert!(rows_in(a.received_between(0, 10_000).await.unwrap()).is_empty());

        b.forget(&a_id).await.unwrap();

        assert!(rows_in(b.received_between(0, 10_000).await.unwrap()).is_empty());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_that_holds_none_of_a_peers_rows_asks_for_the_last_thirty_days_once() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;
        let now = now_ms();
        let days_in = |range: ReceivedRange| range.day_rows.into_iter().map(|rows| rows.day).collect::<Vec<_>>();

        a.set_day_rows(day_rows("2026-08-01", now - DAY_ROWS_CATCH_UP_MS - 1, "old"))
            .await
            .unwrap();
        a.set_day_rows(day_rows("2026-10-08", now - 1_000, "booked"))
            .await
            .unwrap();
        let first = b.pull(&a_id).await.unwrap();

        b.0.db
            .run(|connection| Ok(connection.execute("DELETE FROM received_day_rows", [])?))
            .await
            .unwrap();
        assert!(days_in(b.received_between(0, now).await.unwrap()).is_empty());

        assert_eq!(b.pull(&a_id).await.unwrap().cursor, first.cursor);
        assert_eq!(
            days_in(b.received_between(0, now).await.unwrap()),
            vec!["2026-10-08".to_string()]
        );

        let a_id_held = a_id.clone();
        assert_eq!(
            b.0.db
                .run(move |connection| day_rows_catch_up_from(connection, &a_id_held, now))
                .await
                .unwrap(),
            None
        );
    }

    #[test]
    fn a_pull_from_a_machine_that_predates_day_rows_asks_for_none_outside_the_cursor() {
        let frame: Frame = serde_json::from_str(r#"{"type":"pull","machineId":"m","afterSeq":3,"limit":10}"#).unwrap();

        assert!(matches!(
            frame,
            Frame::Pull {
                day_rows_from_ms: None,
                ..
            }
        ));

        let connection = Connection::open_in_memory().unwrap();

        crate::db::migrate(&connection).unwrap();
        store_day_rows(&connection, &day_rows("2026-10-08", 1_000, "booked")).unwrap();

        let rows_of = |frame: Frame| match frame {
            Frame::Changes { day_rows, .. } => day_rows.unwrap_or_default().len(),
            _ => panic!("not a page"),
        };

        assert_eq!(rows_of(changes_after(&connection, 99, 10, None).unwrap()), 0);
        assert_eq!(rows_of(changes_after(&connection, 99, 10, Some(0)).unwrap()), 1);
        assert_eq!(rows_of(changes_after(&connection, 99, 10, Some(2_000)).unwrap()), 0);
        assert_eq!(rows_of(changes_after(&connection, 0, 10, Some(0)).unwrap()), 1);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn an_updated_event_replaces_its_copy() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;
        let row = collect(&a, 1_000, Some("commit")).await;

        b.pull(&a_id).await.unwrap();
        execute(&a, "UPDATE collected_event SET at_ms = 1500").await;

        assert_eq!(b.pull(&a_id).await.unwrap().upserted, 1);
        assert_eq!(received(&b).await, vec![(a_id, row, 1_500, Some("commit".to_string()))]);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_deleted_event_arrives_as_a_tombstone_and_removes_the_copy() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;

        collect(&a, 1_000, Some("gone")).await;
        let kept = collect(&a, 2_000, Some("kept")).await;

        b.pull(&a_id).await.unwrap();
        execute(&a, "DELETE FROM collected_event WHERE dedupe_key = 'gone'").await;

        let pulled = b.pull(&a_id).await.unwrap();

        assert_eq!((pulled.upserted, pulled.deleted), (0, 1));
        assert_eq!(received(&b).await, vec![(a_id, kept, 2_000, Some("kept".to_string()))]);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_key_held_by_a_copy_whose_tombstone_was_missed_moves_to_the_new_row() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;

        collect(&a, 1_000, Some("calendar")).await;
        b.pull(&a_id).await.unwrap();
        execute(
            &a,
            "DELETE FROM collected_event WHERE dedupe_key = 'calendar'; DELETE FROM deleted_event;",
        )
        .await;

        let replacement = collect(&a, 1_000, Some("calendar")).await;
        let pulled = b.pull(&a_id).await.unwrap();

        assert_eq!((pulled.upserted, pulled.deleted), (1, 1));
        assert_eq!(
            received(&b).await,
            vec![(a_id, replacement, 1_000, Some("calendar".to_string()))]
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_pull_pages_through_more_changes_than_one_page_holds() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;

        for at_ms in 0..7 {
            collect(&a, at_ms, None).await;
        }

        execute(&a, "DELETE FROM collected_event WHERE at_ms = 3").await;

        let pulled = b.pull_in_pages(&a_id, 3).await.unwrap();

        assert_eq!(pulled.upserted, 6);
        assert_eq!(received(&b).await.len(), 6);
        assert!(received(&b).await.iter().all(|(_, _, at_ms, _)| *at_ms != 3));

        let page =
            a.0.db
                .run(|connection| changes_after(connection, 0, 3, None))
                .await
                .unwrap();

        assert!(matches!(page, Frame::Changes { ref events, more: true, .. } if events.len() == 3));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn an_unpaired_certificate_cannot_pull() {
        let (a, b) = (instance("pc"), instance("stranger"));
        let port = a.ensure_listening().await.unwrap();
        let a_id = machine_id(&a).await;
        let a_fingerprint = a.identity().await.unwrap().fingerprint.clone();
        let stored_id = a_id.clone();

        collect(&a, 1_000, None).await;
        b.0.db
            .run(move |connection| {
                store_pairing(
                    connection,
                    &stored_id,
                    "pc",
                    &a_fingerprint,
                    Some(&format!("127.0.0.1:{port}")),
                )
            })
            .await
            .unwrap();

        let error = b.pull(&a_id).await.unwrap_err();

        assert!(error.to_string().contains("not paired"), "{error}");
        assert!(received(&b).await.is_empty());
        assert_eq!(cursor(&b, a_id).await, 0);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_machine_never_serves_the_events_it_received_from_a_third() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;
        let own = collect(&a, 1_000, None).await;

        execute(
            &a,
            "INSERT INTO received_event (machine_id, peer_row_id, at_ms, source, kind, payload, dedupe_key)
             VALUES ('third', 1, 1000, 'git', 'git-commit', '{}', 'theirs')",
        )
        .await;

        b.pull(&a_id).await.unwrap();

        assert_eq!(received(&b).await, vec![(a_id, own, 1_000, None)]);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn reads_the_received_events_of_a_range_under_the_name_their_machine_was_paired_by() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;

        for at_ms in [1_000, 2_000, 3_000] {
            collect(&a, at_ms, None).await;
        }

        b.pull(&a_id).await.unwrap();

        let read = b.received_between(1_500, 3_000).await.unwrap().events;

        assert_eq!(
            read.iter()
                .map(|event| (
                    event.machine_id.as_str(),
                    event.label.as_str(),
                    event.at_ms,
                    event.kind.as_str()
                ))
                .collect::<Vec<_>>(),
            vec![(a_id.as_str(), "pc", 2_000, "git-commit")]
        );
        assert_eq!(read[0].payload, serde_json::json!({}));
        assert!(a.received_between(0, 10_000).await.unwrap().events.is_empty());

        b.forget(&a_id).await.unwrap();

        assert!(b.received_between(0, 10_000).await.unwrap().events.is_empty());
    }

    fn repo_key(path: &str, key: &str) -> RepoKey {
        RepoKey {
            path: path.to_string(),
            key: key.to_string(),
        }
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_pull_brings_the_peers_repo_keys_and_a_later_pull_replaces_them() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;
        let peer_key = |path: &str, key: &str| PeerRepoKey {
            machine_id: a_id.clone(),
            path: path.to_string(),
            key: key.to_string(),
        };

        a.set_repo_keys(vec![
            repo_key("/home/tom/dev/sdk", "gitlab.com/ethlete/sdk"),
            repo_key("/home/tom/dev/notes", "notes"),
        ])
        .await
        .unwrap();
        b.pull(&a_id).await.unwrap();

        assert_eq!(
            b.received_between(0, 1).await.unwrap().repo_keys,
            vec![
                peer_key("/home/tom/dev/notes", "notes"),
                peer_key("/home/tom/dev/sdk", "gitlab.com/ethlete/sdk")
            ]
        );
        assert!(a.received_between(0, 1).await.unwrap().repo_keys.is_empty());
        assert_eq!(
            a.received_between(0, 1).await.unwrap().own_repo_keys,
            vec![
                repo_key("/home/tom/dev/notes", "notes"),
                repo_key("/home/tom/dev/sdk", "gitlab.com/ethlete/sdk")
            ]
        );

        a.set_repo_keys(vec![repo_key("/home/tom/dev/sdk", "gitlab.com/ethlete/sdk")])
            .await
            .unwrap();
        b.pull(&a_id).await.unwrap();

        assert_eq!(
            b.received_between(0, 1).await.unwrap().repo_keys,
            vec![peer_key("/home/tom/dev/sdk", "gitlab.com/ethlete/sdk")]
        );

        b.forget(&a_id).await.unwrap();

        assert!(b.received_between(0, 1).await.unwrap().repo_keys.is_empty());
    }

    #[test]
    fn a_changes_frame_from_a_peer_without_the_map_keeps_the_stored_one() {
        let frame: Frame =
            serde_json::from_str(r#"{"type":"changes","events":[],"deleted":[],"cursor":0,"more":false}"#).unwrap();

        assert!(matches!(
            frame,
            Frame::Changes {
                repo_keys: None,
                day_rows: None,
                ..
            }
        ));

        let mut connection = Connection::open_in_memory().unwrap();

        crate::db::migrate(&connection).unwrap();
        apply_changes(&mut connection, "a", &[], &[], 0, Some(&[repo_key("/x", "k")]), &[]).unwrap();
        apply_changes(&mut connection, "a", &[], &[], 0, None, &[]).unwrap();

        assert_eq!(
            connection
                .query_row("SELECT count(*) FROM peer_repo_key WHERE machine_id = 'a'", [], |row| {
                    row.get::<_, i64>(0)
                })
                .unwrap(),
            1
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn a_renamed_machine_reads_under_the_name_given_and_under_its_host_name_once_cleared() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;

        collect(&a, 2_000, None).await;
        b.pull(&a_id).await.unwrap();

        assert!(b.rename(&a_id, "  Desk  ").await.unwrap());
        assert_eq!(b.list().await.unwrap()[0].label, "Desk");
        assert_eq!(b.received_between(0, 10_000).await.unwrap().events[0].label, "Desk");

        b.hello(&a_id).await.unwrap();

        assert_eq!(b.list().await.unwrap()[0].label, "Desk");

        assert!(b.rename(&a_id, "   ").await.unwrap());
        assert_eq!(b.list().await.unwrap()[0].label, "pc");
        assert_eq!(b.received_between(0, 10_000).await.unwrap().events[0].label, "pc");
        assert!(!b.rename("nobody", "x").await.unwrap());
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn records_when_the_last_pull_succeeded() {
        let (a, b) = (instance("pc"), instance("laptop"));

        pair(&a, &b).await;

        let a_id = machine_id(&a).await;

        assert_eq!(b.list().await.unwrap()[0].last_pull_ms, None);

        let before = now_ms();

        b.pull(&a_id).await.unwrap();

        let pulled = b.list().await.unwrap()[0].last_pull_ms.unwrap();

        assert!(pulled >= before && pulled <= now_ms());
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
            b.answer(&serde_json::json!({ "op": "peers.pull", "machineId": id }))
                .await
                .unwrap()["upserted"],
            0
        );
        assert_eq!(
            b.answer(&serde_json::json!({ "op": "peers.received", "fromMs": 0, "toMs": 1 }))
                .await
                .unwrap(),
            serde_json::json!({ "events": [], "repoKeys": [], "ownRepoKeys": [], "dayRows": [] })
        );
        assert_eq!(
            b.answer(&serde_json::json!({ "op": "peers.rename", "machineId": id, "name": "Desk" }))
                .await
                .unwrap()["renamed"],
            true
        );
        assert_eq!(
            b.answer(&serde_json::json!({ "op": "peers.forget", "machineId": id }))
                .await
                .unwrap()["forgotten"],
            true
        );
        assert!(b.answer(&serde_json::json!({ "op": "peers.nope" })).await.is_err());
    }
}
