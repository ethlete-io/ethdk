use super::{address, now_ms, rejected, Identity};
use crate::error::TimetrackResult;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub const SERVICE_TYPE: &str = "_timetrack._tcp.local.";
const PROTOCOL_VERSION: &str = "1";
const GOODBYE_TIMEOUT: Duration = Duration::from_millis(300);

/// A machine that advertised itself on the LAN. Nothing here is trusted: the pinned fingerprint in
/// the TLS hello is the only identity check.
#[derive(Clone, Debug, PartialEq)]
pub struct Found {
    pub fullname: String,
    pub machine_id: String,
    pub label: String,
    pub addresses: Vec<IpAddr>,
    pub port: u16,
    pub fingerprint: String,
    pub last_seen_ms: i64,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Discovered {
    pub machine_id: String,
    pub label: String,
    pub addresses: Vec<String>,
    pub port: u16,
    pub fingerprint: String,
    pub paired: bool,
    pub last_seen_ms: i64,
}

impl Found {
    /// A machine is paired when the id and the pinned fingerprint both match what it advertises.
    pub fn describe(&self, paired: &[super::PairedMachine]) -> Discovered {
        Discovered {
            machine_id: self.machine_id.clone(),
            label: self.label.clone(),
            addresses: self.addresses.iter().map(IpAddr::to_string).collect(),
            port: self.port,
            fingerprint: self.fingerprint.clone(),
            paired: paired
                .iter()
                .any(|machine| machine.machine_id == self.machine_id && machine.cert_fingerprint == self.fingerprint),
            last_seen_ms: self.last_seen_ms,
        }
    }
}

fn unescape_instance(name: &str) -> String {
    let mut label = String::with_capacity(name.len());
    let mut chars = name.chars();

    while let Some(character) = chars.next() {
        match (character, chars.clone().next()) {
            ('\\', Some(next @ ('.' | '\\'))) => {
                label.push(next);
                chars.next();
            }
            _ => label.push(character),
        }
    }

    label
}

fn instance_label(fullname: &str) -> String {
    unescape_instance(
        fullname
            .strip_suffix(SERVICE_TYPE)
            .unwrap_or(fullname)
            .trim_end_matches('.'),
    )
}

/// Reads an advertisement, or `None` when it lacks an id or fingerprint or speaks another version.
pub fn parse_advert(
    fullname: &str,
    addresses: impl IntoIterator<Item = IpAddr>,
    port: u16,
    property: impl Fn(&str) -> Option<String>,
    last_seen_ms: i64,
) -> Option<Found> {
    if property("v")? != PROTOCOL_VERSION {
        return None;
    }

    let machine_id = property("id").filter(|id| !id.is_empty())?;
    let fingerprint = property("fp").filter(|fingerprint| !fingerprint.is_empty())?;
    let addresses = ranked(addresses);

    if addresses.is_empty() {
        return None;
    }

    Some(Found {
        fullname: fullname.to_string(),
        machine_id,
        label: instance_label(fullname),
        addresses,
        port,
        fingerprint,
        last_seen_ms,
    })
}

fn rank(ip: &IpAddr) -> Option<u8> {
    match ip {
        IpAddr::V4(ip) if ip.is_loopback() || ip.is_unspecified() => None,
        IpAddr::V4(ip) if ip.is_link_local() => Some(1),
        IpAddr::V4(_) => Some(0),
        IpAddr::V6(ip) if ip.is_loopback() || ip.is_unspecified() || (ip.segments()[0] & 0xffc0) == 0xfe80 => None,
        IpAddr::V6(_) => Some(2),
    }
}

/// The addresses worth dialing, best first: private or routable IPv4, link-local IPv4, then global
/// IPv6. Loopback and scope-less link-local IPv6 never leave this machine usefully.
pub fn ranked(addresses: impl IntoIterator<Item = IpAddr>) -> Vec<IpAddr> {
    let mut usable: Vec<(u8, IpAddr)> = addresses
        .into_iter()
        .filter_map(|ip| rank(&ip).map(|rank| (rank, ip)))
        .collect();

    usable.sort();
    usable.dedup();

    usable.into_iter().map(|(_, ip)| ip).collect()
}

pub struct Directory {
    own_machine_id: String,
    found: HashMap<String, Found>,
}

impl Directory {
    pub fn new(own_machine_id: String) -> Self {
        Self {
            own_machine_id,
            found: HashMap::new(),
        }
    }

    /// Records `found`, replacing what the same machine advertised before. Returns whether it was
    /// kept: this machine's own advertisement is not.
    pub fn resolve(&mut self, found: Found) -> bool {
        if found.machine_id == self.own_machine_id {
            return false;
        }

        self.found
            .retain(|id, known| id == &found.machine_id || known.fullname != found.fullname);
        self.found.insert(found.machine_id.clone(), found);

        true
    }

    pub fn remove(&mut self, fullname: &str) {
        self.found.retain(|_, found| found.fullname != fullname);
    }

    pub fn get(&self, machine_id: &str) -> Option<&Found> {
        self.found.get(machine_id)
    }

    pub fn list(&self) -> Vec<Found> {
        let mut all: Vec<Found> = self.found.values().cloned().collect();

        all.sort_by(|a, b| a.label.cmp(&b.label).then_with(|| a.machine_id.cmp(&b.machine_id)));

        all
    }
}

/// Points a paired machine at the address it advertises now. Both the id and the pinned fingerprint
/// must match, so a stranger claiming a paired machine's id redirects nothing. Returns whether the
/// stored address changed.
pub fn store_addr(connection: &Connection, machine_id: &str, fingerprint: &str, addr: &str) -> TimetrackResult<bool> {
    Ok(connection.execute(
        "UPDATE paired_machine SET last_addr = ?3
         WHERE machine_id = ?1 AND cert_fingerprint = ?2 AND last_addr IS NOT ?3",
        params![machine_id, fingerprint, addr],
    )? > 0)
}

/// Advertises this machine while the listener is open and browses for others. Dropping it says
/// goodbye and stops the daemon.
pub struct Discovery {
    daemon: ServiceDaemon,
    advertised: Option<String>,
    pub directory: Arc<Mutex<Directory>>,
}

impl Discovery {
    pub fn start(identity: &Identity, db: crate::state::Db) -> TimetrackResult<Self> {
        let daemon = ServiceDaemon::new().map_err(rejected)?;
        let events = daemon.browse(SERVICE_TYPE).map_err(rejected)?;
        let directory = Arc::new(Mutex::new(Directory::new(identity.machine_id.clone())));
        let shared = directory.clone();

        tokio::spawn(async move {
            while let Ok(event) = events.recv_async().await {
                match event {
                    ServiceEvent::ServiceResolved(service) => {
                        let Some(found) = parse_advert(
                            &service.fullname,
                            service.addresses.iter().map(|ip| ip.to_ip_addr()),
                            service.port,
                            |key| service.txt_properties.get_property_val_str(key).map(str::to_string),
                            now_ms(),
                        ) else {
                            continue;
                        };
                        let (machine_id, fingerprint, addr) = (
                            found.machine_id.clone(),
                            found.fingerprint.clone(),
                            address(found.addresses[0], found.port),
                        );

                        if !shared.lock().is_ok_and(|mut directory| directory.resolve(found)) {
                            continue;
                        }

                        let _ = db
                            .run(move |connection| store_addr(connection, &machine_id, &fingerprint, &addr))
                            .await;
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        if let Ok(mut directory) = shared.lock() {
                            directory.remove(&fullname);
                        }
                    }
                    _ => {}
                }
            }
        });

        Ok(Self {
            daemon,
            advertised: None,
            directory,
        })
    }

    /// Advertises once; the listener keeps one port for its whole life.
    pub fn advertise(&mut self, identity: &Identity, port: u16) -> TimetrackResult<()> {
        if self.advertised.is_some() {
            return Ok(());
        }

        let host = format!(
            "timetrack-{}.local.",
            identity.machine_id.chars().take(8).collect::<String>()
        );
        let properties = HashMap::from([
            ("id".to_string(), identity.machine_id.clone()),
            ("fp".to_string(), identity.fingerprint.clone()),
            ("v".to_string(), PROTOCOL_VERSION.to_string()),
        ]);
        let info = ServiceInfo::new(SERVICE_TYPE, &identity.label, &host, "", port, properties)
            .map_err(rejected)?
            .enable_addr_auto();
        let fullname = info.get_fullname().to_string();

        self.daemon.register(info).map_err(rejected)?;
        self.advertised = Some(fullname);

        Ok(())
    }
}

impl Drop for Discovery {
    fn drop(&mut self) {
        if let Some(fullname) = self.advertised.take() {
            if let Ok(done) = self.daemon.unregister(&fullname) {
                let _ = done.recv_timeout(GOODBYE_TIMEOUT);
            }
        }

        let _ = self.daemon.shutdown();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    fn v4(a: u8, b: u8, c: u8, d: u8) -> IpAddr {
        IpAddr::V4(Ipv4Addr::new(a, b, c, d))
    }

    fn props<'a>(pairs: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<String> + 'a {
        move |key| pairs.iter().find(|(k, _)| *k == key).map(|(_, v)| v.to_string())
    }

    fn advert(fullname: &str, id: &str, fingerprint: &str) -> Option<Found> {
        parse_advert(
            fullname,
            [v4(192, 168, 1, 5)],
            52741,
            props(&[("id", id), ("fp", fingerprint), ("v", "1")]),
            10,
        )
    }

    #[test]
    fn parses_a_complete_advertisement_and_takes_the_label_from_the_instance() {
        let found = advert("my\\.laptop._timetrack._tcp.local.", "m1", "ab").unwrap();

        assert_eq!(found.label, "my.laptop");
        assert_eq!(found.machine_id, "m1");
        assert_eq!(found.fingerprint, "ab");
        assert_eq!(found.port, 52741);
    }

    #[test]
    fn rejects_an_advertisement_missing_a_field_or_with_another_version() {
        let name = "pc._timetrack._tcp.local.";
        let parse = |pairs: &[(&str, &str)]| parse_advert(name, [v4(192, 168, 1, 5)], 1, props(pairs), 0);

        assert!(parse(&[("id", "m"), ("fp", "f"), ("v", "1")]).is_some());
        assert!(parse(&[("fp", "f"), ("v", "1")]).is_none());
        assert!(parse(&[("id", "m"), ("v", "1")]).is_none());
        assert!(parse(&[("id", "m"), ("fp", "f")]).is_none());
        assert!(parse(&[("id", "m"), ("fp", "f"), ("v", "2")]).is_none());
        assert!(parse_advert(
            name,
            [v4(127, 0, 0, 1)],
            1,
            props(&[("id", "m"), ("fp", "f"), ("v", "1")]),
            0
        )
        .is_none());
    }

    #[test]
    fn prefers_ipv4_non_loopback_and_drops_unusable_addresses() {
        let global = IpAddr::V6("2001:db8::1".parse::<Ipv6Addr>().unwrap());
        let scoped = IpAddr::V6("fe80::1".parse::<Ipv6Addr>().unwrap());

        assert_eq!(
            ranked([global, v4(169, 254, 3, 3), scoped, v4(127, 0, 0, 1), v4(192, 168, 1, 5)]),
            vec![v4(192, 168, 1, 5), v4(169, 254, 3, 3), global]
        );
        assert!(ranked([v4(127, 0, 0, 1), scoped]).is_empty());
    }

    #[test]
    fn a_machine_that_moves_replaces_its_entry_and_our_own_is_skipped() {
        let mut directory = Directory::new("me".to_string());

        assert!(!directory.resolve(advert("me._timetrack._tcp.local.", "me", "f0").unwrap()));
        assert!(directory.resolve(advert("pc._timetrack._tcp.local.", "m1", "f1").unwrap()));

        let mut moved = advert("pc._timetrack._tcp.local.", "m1", "f1").unwrap();

        moved.addresses = vec![v4(10, 0, 0, 9)];
        assert!(directory.resolve(moved));

        let all = directory.list();

        assert_eq!(all.len(), 1);
        assert_eq!(all[0].addresses, vec![v4(10, 0, 0, 9)]);
        assert_eq!(directory.get("m1").unwrap().label, "pc");

        directory.remove("pc._timetrack._tcp.local.");
        assert!(directory.list().is_empty());
    }

    #[test]
    fn flags_a_machine_paired_only_when_id_and_fingerprint_both_match() {
        let found = advert("pc._timetrack._tcp.local.", "m1", "f1").unwrap();
        let paired = |id: &str, fingerprint: &str| super::super::PairedMachine {
            machine_id: id.to_string(),
            label: "pc".to_string(),
            cert_fingerprint: fingerprint.to_string(),
            last_addr: None,
            last_seen_ms: None,
            clock_offset_ms: None,
            paired_at_ms: 0,
        };

        assert!(found.describe(&[paired("m1", "f1")]).paired);
        assert!(!found.describe(&[paired("m1", "other")]).paired);
        assert!(!found.describe(&[paired("m2", "f1")]).paired);
        assert!(!found.describe(&[]).paired);
    }

    #[test]
    fn store_addr_updates_only_a_paired_machine_with_the_pinned_fingerprint() {
        let mut connection = Connection::open_in_memory().unwrap();

        crate::db::migrate(&connection).unwrap();
        super::super::store_pairing(&mut connection, "m1", "pc", "f1", Some("192.168.1.5:52741")).unwrap();

        let stored = || {
            super::super::paired_where(&connection, "machine_id", "m1")
                .unwrap()
                .unwrap()
                .last_addr
        };

        assert!(!store_addr(&connection, "m1", "f1", "192.168.1.5:52741").unwrap());
        assert!(!store_addr(&connection, "m1", "forged", "6.6.6.6:1").unwrap());
        assert!(!store_addr(&connection, "unknown", "f1", "6.6.6.6:1").unwrap());
        assert_eq!(stored(), Some("192.168.1.5:52741".to_string()));
        assert!(store_addr(&connection, "m1", "f1", "10.0.0.9:52741").unwrap());
        assert_eq!(stored(), Some("10.0.0.9:52741".to_string()));
    }
}
