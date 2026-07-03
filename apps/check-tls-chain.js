/**
 * check-tls-chain.js
 *
 * Diagnostik berdiri sendiri (tidak bergantung pada NestJS/Prisma) untuk
 * memastikan/menyangkal dugaan SSL/TLS inspection di jaringan lokal, yang
 * dicurigai jadi penyebab `UNABLE_TO_VERIFY_LEAF_SIGNATURE` saat
 * `import-wilayah.ts` menghubungi emsifa.com — walau CA tambahan (WE1) dan
 * `--use-system-ca` sudah dicoba.
 *
 * Cara pakai:
 *   node check-tls-chain.js
 *
 * Cara baca hasil:
 *   - Bandingkan field `issuer` dan `fingerprint256` dari emsifa.com vs
 *     github.com (domain kontrol yang diasumsikan tidak diblok/inspect).
 *   - Kalau issuer emsifa.com menyebut nama organisasi internal/instansi
 *     sendiri (bukan "Google Trust Services", "Let's Encrypt", dsb.) ->
 *     hampir pasti ada SSL inspection (MITM proxy) yang mengganti sertifikat
 *     asli dengan sertifikat yang ditandatangani root CA internal.
 *   - Kalau issuer github.com JUGA menyebut organisasi internal (padahal
 *     harusnya DigiCert/GTS/dsb.) -> mengkonfirmasi SEMUA trafik HTTPS
 *     keluar di-inspect, bukan cuma emsifa.com -> memperkuat dugaan
 *     firewall/proxy korporat (konsisten dengan temuan FortiGuard SDNS
 *     sebelumnya).
 *   - Kalau issuer keduanya terlihat normal (organisasi CA publik yang
 *     dikenal) -> kemungkinan SSL inspection SALAH, dan masalahnya balik ke
 *     isu chain/intermediate biasa -> perlu cek ulang CA mana yang benar-
 *     benar dikirim server vs yang ada di certs/.
 */

const tls = require("tls");

const TARGETS = [
  { host: "www.emsifa.com", port: 443 },
  { host: "github.com", port: 443 }, // domain kontrol
  { host: "raw.githubusercontent.com", port: 443 }, // domain kontrol ke-2
];

function inspect(host, port) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host, // wajib untuk SNI
        rejectUnauthorized: false, // sengaja: kita mau LIHAT sertifikatnya,
        // bukan memvalidasinya. Ini aman karena hanya membaca metadata,
        // tidak mengirim data sensitif.
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const authorized = socket.authorized;
        const authError = socket.authorizationError;

        // Kumpulkan seluruh chain (leaf -> intermediate -> ... )
        const chain = [];
        let current = cert;
        const seen = new Set();
        while (
          current &&
          Object.keys(current).length &&
          !seen.has(current.fingerprint256)
        ) {
          seen.add(current.fingerprint256);
          chain.push({
            subject: current.subject,
            issuer: current.issuer,
            valid_from: current.valid_from,
            valid_to: current.valid_to,
            fingerprint256: current.fingerprint256,
          });
          current = current.issuerCertificate;
        }

        resolve({
          host,
          ok: true,
          authorized,
          authError: authError ? String(authError) : null,
          chainLength: chain.length,
          chain,
        });
        socket.end();
      },
    );

    socket.on("error", (err) => {
      resolve({ host, ok: false, error: String(err) });
    });

    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({ host, ok: false, error: "timeout (10s)" });
    });
  });
}

(async () => {
  console.log("=== TLS Chain Diagnostic ===");
  console.log(
    "Membandingkan sertifikat yang benar-benar diterima jaringan ini",
  );
  console.log(
    "untuk emsifa.com vs domain kontrol (github.com, raw.githubusercontent.com).\n",
  );

  for (const { host, port } of TARGETS) {
    const res = await inspect(host, port);
    console.log(`--- ${host} ---`);
    if (!res.ok) {
      console.log(`  GAGAL connect: ${res.error}\n`);
      continue;
    }
    console.log(
      `  authorized (dgn trust store default Node): ${res.authorized}`,
    );
    if (res.authError) console.log(`  authorizationError: ${res.authError}`);
    console.log(`  panjang chain yang diterima: ${res.chainLength}`);
    res.chain.forEach((c, i) => {
      console.log(`  [${i}] subject: ${JSON.stringify(c.subject)}`);
      console.log(`      issuer : ${JSON.stringify(c.issuer)}`);
      console.log(`      valid  : ${c.valid_from} s/d ${c.valid_to}`);
      console.log(`      sha256 : ${c.fingerprint256}`);
    });
    console.log("");
  }

  console.log("=== Kesimpulan cepat ===");
  console.log(
    "Cek manual: apakah field `issuer.O` (organization) di atas cocok",
  );
  console.log(
    "dengan CA publik yang dikenal (Google Trust Services, DigiCert,",
  );
  console.log("Let's Encrypt, dll)? Kalau salah satu/semua domain menunjukkan");
  console.log(
    "issuer dengan nama instansi/perusahaan sendiri -> itu bukti kuat",
  );
  console.log("SSL inspection. Kalau semuanya CA publik normal -> problem TLS");
  console.log(
    "emsifa.com kemungkinan besar bukan SSL inspection, cek ulang isi",
  );
  console.log("certs/*.pem vs chain yang benar-benar dikirim di atas.");
})();
