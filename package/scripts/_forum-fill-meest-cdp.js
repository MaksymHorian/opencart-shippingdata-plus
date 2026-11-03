const fs = require('fs');
const b64 = fs.readFileSync('c:/OpenServer/home/oc3/package/scripts/_forum-fill-meest-b64.txt', 'utf8').trim();
const chunk = 8000;
const parts = [];
for (let i = 0; i < b64.length; i += chunk) {
  parts.push(b64.slice(i, i + chunk));
}
const js = 'window.__B64P=' + JSON.stringify(parts) + '; eval(atob(window.__B64P.join("")));';
fs.writeFileSync('c:/OpenServer/home/oc3/package/scripts/_forum-fill-meest-cdp.txt', js);
console.log('parts', parts.length, 'js', js.length);
