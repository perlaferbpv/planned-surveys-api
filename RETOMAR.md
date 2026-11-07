# Retomar aquí

Resumen corto del trabajo en curso. Copia extendida en tu almacén Cursor personal:  
`planned-surveys-convertidor-resumen.md`

## Estado

- Convertidor listo en **`web/`** (navegador, sin servidor).
- API opcional en **`app/`**.
- Azure corporativo **no** permitió App Service; siguiente camino: **GitHub Pages** o Netlify.

## Siguiente paso (GitHub ya enlazado en Cursor)

Guía paso a paso: **`GITHUB.md`**

1. Cursor → **Source Control** → Initialize → Commit → **Publish to GitHub** (repo público si quieres URL abierta).
2. En GitHub → **Settings → Pages → Source: GitHub Actions**.
3. Esperar el workflow **GitHub Pages (convertidor web)** en verde.
4. Abrir `https://<usuario>.github.io/<nombre-repo>/`.

## Probar en local

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api\web
python -m http.server 8080
```

Ver **`README.md`** → sección *Hosting sin Azure*.
