const fs = require('fs');
const b64 = fs.readFileSync('c:/OpenServer/home/oc3/package/scripts/_forum-fill-meest-b64.txt', 'utf8').trim();
const chunk = 8000;
const parts = [];
for (let i = 0; i < b64.length; i += chunk) {
  parts.push(b64.slice(i, i + chunk));
}
parts.forEach((p, i) => {
  const expr = i === 0
    ? 'window.__B64P=[' + JSON.stringify(p) + ']; "part0"'
    : i === parts.length - 1
      ? 'window.__B64P.push(' + JSON.stringify(p) + '); eval(atob(window.__B64P.join("")));'
      : 'window.__B64P.push(' + JSON.stringify(p) + '); "part' + i + '"';
  fs.writeFileSync('c:/OpenServer/home/oc3/package/scripts/_forum-fill-meest-cdp-part' + i + '.txt', expr);
});
console.log('wrote', parts.length, 'parts');
