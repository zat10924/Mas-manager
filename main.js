const { app, BrowserWindow, Menu, shell } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

/* لو عايز البرنامج يفتح الموقع الأونلاين (يتحدث لوحده من GitHub) اكتب الرابط هنا،
   مثال: "https://USERNAME.github.io/" — سيبه فاضي ليشتغل بالملفات المدمجة. */
const REMOTE_URL = "";

const PORT = 47631; // بورت ثابت عشان بيانات الجهاز (localStorage/IndexedDB) تفضل محفوظة
const ROOT = path.join(__dirname, "app");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/") p = "/index.html";
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (e, d) => {
        if (e) { res.writeHead(404); return res.end("Not found"); }
        res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
        res.end(d);
      });
    });
    srv.on("error", () => srv.listen(0, "127.0.0.1", () => resolve(srv.address().port)));
    srv.listen(PORT, "127.0.0.1", () => resolve(PORT));
  });
}

async function createWindow() {
  const url = REMOTE_URL || `http://127.0.0.1:${await startServer()}/index.html`;
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 420, minHeight: 600,
    title: "إدارة الأقسام",
    icon: path.join(ROOT, "icon-512.png"),
    backgroundColor: "#421B24",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.setMenuBarVisibility(false);
  win.loadURL(url);

  // أي رابط خارجي يفتح في المتصفح العادي، مش جوه البرنامج
  const origin = new URL(url).origin;
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    if (new URL(u).origin === origin) return { action: "allow" };
    shell.openExternal(u);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, u) => {
    if (new URL(u).origin !== origin) { e.preventDefault(); shell.openExternal(u); }
  });
}

Menu.setApplicationMenu(null);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => app.quit());
}
