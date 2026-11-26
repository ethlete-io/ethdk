// CEF's MemoryInfra uses signed mallinfo counters and aborts when their sum exceeds 2 GiB.
// Export this from the executable so libcef resolves it before glibc's wrapping implementation.
// https://github.com/chromiumembedded/cef/issues/3963
#[no_mangle]
pub extern "C" fn mallinfo() -> libc::mallinfo {
    bounded_mallinfo(unsafe { libc::mallinfo2() })
}

fn bounded_mallinfo(info: libc::mallinfo2) -> libc::mallinfo {
    let bounded = |value: usize| value.min(libc::c_int::MAX as usize) as libc::c_int;
    let arena = bounded(info.arena);

    libc::mallinfo {
        arena,
        ordblks: bounded(info.ordblks),
        smblks: bounded(info.smblks),
        hblks: bounded(info.hblks),
        hblkhd: info.hblkhd.min((libc::c_int::MAX - arena) as usize) as libc::c_int,
        usmblks: bounded(info.usmblks),
        fsmblks: bounded(info.fsmblks),
        uordblks: bounded(info.uordblks),
        fordblks: bounded(info.fordblks),
        keepcost: bounded(info.keepcost),
    }
}

// glibc lifts its mmap threshold to the size of each large block freed, so later IPC bodies of that
// size land in one of up to 8 x cores arenas and stay resident after they are freed. A fixed
// threshold returns them on free; the arena cap bounds how many heaps hold freed small blocks.
pub fn bound_retained_heap() {
    unsafe {
        libc::mallopt(libc::M_MMAP_THRESHOLD, 1 << 20);
        libc::mallopt(libc::M_ARENA_MAX, 8);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stats(arena: usize, hblkhd: usize, uordblks: usize) -> libc::mallinfo2 {
        libc::mallinfo2 {
            arena,
            hblkhd,
            uordblks,
            ..unsafe { std::mem::zeroed() }
        }
    }

    #[test]
    fn preserves_statistics_below_the_legacy_limit() {
        let info = bounded_mallinfo(stats(1_000_000, 200_000, 500_000));
        assert_eq!(info.arena + info.hblkhd, 1_200_000);
        assert_eq!(info.uordblks, 500_000);
    }

    #[test]
    fn crash_dump_heap_sizes_do_not_overflow_chromiums_checked_sum() {
        for (arena, allocated) in [(0x8055b000, 0x07123030), (0x89ca9000, 0x08f79240)] {
            let info = bounded_mallinfo(stats(arena, 0x007d5060, allocated));
            assert_eq!(info.arena.checked_add(info.hblkhd), Some(libc::c_int::MAX));
            assert_eq!(info.uordblks, allocated as libc::c_int);
        }
    }

    #[test]
    fn caps_the_sum_even_when_each_counter_fits_individually() {
        let info = bounded_mallinfo(stats(1 << 30, 1 << 30, usize::MAX));
        assert_eq!(info.arena.checked_add(info.hblkhd), Some(libc::c_int::MAX));
        assert_eq!(info.uordblks, libc::c_int::MAX);
    }

    const RETENTION_CHILD: &str = "TIMETRACK_HEAP_RETENTION_CHILD";

    fn rss_anon_mib() -> usize {
        let status = std::fs::read_to_string("/proc/self/status").unwrap();
        let line = status.lines().find(|line| line.starts_with("RssAnon:")).unwrap();
        line.split_whitespace().nth(1).unwrap().parse::<usize>().unwrap() / 1024
    }

    fn allocate_and_free_on_fresh_threads(sizes_mib: impl Iterator<Item = usize>) {
        let threads: Vec<_> = sizes_mib
            .map(|size| std::thread::spawn(move || std::hint::black_box(vec![1u8; size << 20]).len()))
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
    }

    #[test]
    fn freed_ipc_sized_bodies_do_not_stay_resident() {
        if std::env::var_os(RETENTION_CHILD).is_none() {
            let status = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "cef_malloc::tests::freed_ipc_sized_bodies_do_not_stay_resident",
                ])
                .env(RETENTION_CHILD, "1")
                .status()
                .unwrap();
            assert!(status.success());
            return;
        }

        bound_retained_heap();
        let before = rss_anon_mib();
        for _ in 0..20 {
            allocate_and_free_on_fresh_threads([24, 9].into_iter());
        }
        allocate_and_free_on_fresh_threads((0..64).map(|index| 8 + index % 16));

        let retained = rss_anon_mib().saturating_sub(before);
        assert!(retained < 32, "{retained} MiB of freed bodies stayed resident");
    }
}
