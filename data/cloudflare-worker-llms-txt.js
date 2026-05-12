// Cloudflare Worker — sert /llms.txt sur autoecole-inris.com
//
// DEPLOIEMENT :
// 1. Cloudflare Dashboard → Workers & Pages → Create → Hello World (placeholder)
// 2. Nommer : "inris-llms-txt"
// 3. Coller TOUT ce fichier dans l'éditeur → Deploy
// 4. Workers & Pages → ton worker → Settings → Triggers → Add route
//    - Route : autoecole-inris.com/llms.txt    | Zone : autoecole-inris.com
//    - Route : www.autoecole-inris.com/llms.txt | Zone : autoecole-inris.com
// 5. Tester : curl https://www.autoecole-inris.com/llms.txt
//
// MISE A JOUR : régénérer data/llms.txt (node scripts/iris-build-llms-txt.mjs),
// puis ré-exécuter scripts/iris-deploy-llms-worker.mjs pour reconstruire ce fichier
// avec le contenu à jour, et redéployer le Worker.

const LLMS_TXT = `__LLMS_TXT_CONTENT__`

export default {
  async fetch(request) {
    return new Response(LLMS_TXT, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Robots-Tag": "index, follow",
        "Access-Control-Allow-Origin": "*",
      },
    })
  },
}
