import helmet from "helmet";
import cors from "cors";
import { IS_PROD, FRONTEND_ORIGINS, CORS_ALLOW_ALL } from "../config.js";

function setupHelmet(app) {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          "default-src": ["'none'"],
          "frame-ancestors": ["'none'"],
          "report-uri": ["/csp-report"]
        }
      }
    })
  );
}

function setupCors(app) {
  app.use(
    cors({
      origin(origin, callback) {
        // Requests sem Origin (curl, server-to-server, same-origin): negar
        // silenciosamente — não refletir.
        if (!origin) {
          return callback(null, false);
        }

        // Flag de escape explícita para desenvolvimento local. Só efetiva
        // quando CORS_ALLOW_ALL=true está configurado conscientemente.
        if (CORS_ALLOW_ALL) return callback(null, true);

        // Lista configurada: aceitar apenas origens presentes na allowlist.
        if (FRONTEND_ORIGINS.length) {
          if (FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
          return callback(new Error("Origem não permitida por CORS"));
        }

        // FRONTEND_ORIGINS vazia — sem lista configurada.
        // Permitir apenas localhost em ambiente não-produção (dev local puro).
        // Em qualquer outro caso (EB staging, prod, etc.) negar por padrão.
        // Isso impede reflect-origin irrestrito quando a var não é setada.
        if (!IS_PROD && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }

        return callback(new Error("Origem não permitida por CORS"));
      },
      credentials: true
    })
  );
}

function securityHeadersMiddleware(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (IS_PROD) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  if (req.path !== "/health") {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}

function contentTypeMiddleware(_req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return json(body);
  };

  const send = res.send.bind(res);
  res.send = (body) => {
    const current = String(res.getHeader("Content-Type") || "");
    if (typeof body === "string" && (!current || current.startsWith("text/"))) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    return send(body);
  };

  next();
}

export { setupHelmet, setupCors, securityHeadersMiddleware, contentTypeMiddleware };
