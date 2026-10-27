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
}
