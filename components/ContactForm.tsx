"use client";

import { useEffect, useState, type FormEvent } from "react";

type ContactFormState = { name: string; email: string; msg: string };
type ContactStatus = "idle" | "sending" | "sent" | "error";
type ContactResponseBody = { ok: true } | { ok: false; error: string };

const EMPTY_FORM: ContactFormState = { name: "", email: "", msg: "" };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactForm() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [shake, setShake] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentName, setSentName] = useState("");

  const triggerShake = (msg: string) => {
    setValidationMsg(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();
    const msg = form.msg.trim();

    if (!name || !email || !msg) {
      triggerShake("Completa todos los campos antes de enviar.");
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      triggerShake("Ingresa un correo electrónico válido.");
      return;
    }

    setValidationMsg(null);
    setServerError(null);
    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, msg }),
      });
      const data = (await res.json()) as ContactResponseBody;

      if (!data.ok) {
        setServerError(data.error);
        setStatus("error");
        return;
      }

      setSentName(name);
      setStatus("sent");
    } catch {
      setServerError("No se pudo enviar el mensaje. Revisa tu conexión e intenta de nuevo.");
      setStatus("error");
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setStatus("idle");
    setServerError(null);
    setValidationMsg(null);
  };

  if (status === "sent") {
    return (
      <div className="terminal-success">
        <div className="term-bar">
          <span className="dot r"></span>
          <span className="dot y"></span>
          <span className="dot g"></span>
          <span className="term-title">VAULT-OS // TERMINAL</span>
        </div>
        <div className="term-body">
          <div className="line">
            <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
          </div>
          <div className="line dim">[OK] Conectando con servidor…</div>
          <div className="line dim">[OK] Validando contenido…</div>
          <div className="line dim">[OK] Transmitiendo paquete…</div>
          <div className="line success">
            &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sentName.toUpperCase()}.
            <span className="caret">_</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn ghost" type="button" onClick={resetForm}>
              ENVIAR OTRO MENSAJE
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit}>
      <div className="field">
        <label>NOMBRE</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="px_kai"
        />
      </div>
      <div className="field">
        <label>CORREO ELECTRÓNICO</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="jugador@vault.gg"
        />
      </div>
      <div className="field">
        <label>MENSAJE</label>
        <textarea
          rows={5}
          value={form.msg}
          onChange={(e) => setForm({ ...form, msg: e.target.value })}
          placeholder="Cuéntanos qué tienes en mente…"
        ></textarea>
      </div>

      {validationMsg && (
        <p
          className="pixel"
          style={{ color: "var(--magenta)", fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}
        >
          ⚠ {validationMsg}
        </p>
      )}
      {status === "error" && serverError && (
        <p
          className="pixel"
          style={{ color: "var(--magenta)", fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}
        >
          ⚠ {serverError}
        </p>
      )}

      <button className="btn xl press" type="submit" style={{ width: "100%" }} disabled={sending}>
        {sending ? (
          <>
            <span className="spinner" style={{ marginRight: 8, verticalAlign: "-3px" }} />
            ENVIANDO…
          </>
        ) : (
          "▶  ENVIAR MENSAJE"
        )}
      </button>
    </form>
  );
}
