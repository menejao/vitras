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
        if (!origin) {
          return callback(null, true);
        }
        if (!FRONTEND_ORIGINS.length) {
          if (!IS_PROD || CORS_ALLOW_ALL) return callback(null, true);
          return callback(new Error("Origem não permitida por CORS"));
        }
        if (CORS_ALLOW_ALL) return callback(null, true);
        if (FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
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
