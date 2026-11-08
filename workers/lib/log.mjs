// Log terstruktur JSON-lines. Satu baris = satu event; aman untuk journald/CI.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function buatLog({ level = "info", konteks = {} } = {}) {
  const ambang = LEVELS[level] ?? LEVELS.info;
  const tulis = (nama, pesan, data = {}) => {
    if ((LEVELS[nama] ?? 20) < ambang) return;
    const baris = {
      ts: new Date().toISOString(),
      level: nama,
      msg: pesan,
      ...konteks,
      ...data,
    };
    const aliran = nama === "error" || nama === "warn" ? process.stderr : process.stdout;
    aliran.write(`${JSON.stringify(baris)}\n`);
  };
  return {
    debug: (pesan, data) => tulis("debug", pesan, data),
    info: (pesan, data) => tulis("info", pesan, data),
    warn: (pesan, data) => tulis("warn", pesan, data),
    error: (pesan, data) => tulis("error", pesan, data),
    anak: (tambahan) => buatLog({ level, konteks: { ...konteks, ...tambahan } }),
  };
}
