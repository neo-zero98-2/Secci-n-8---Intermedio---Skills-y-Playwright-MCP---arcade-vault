import { Resend } from "resend";

type ContactRequestBody = { name: string; email: string; msg: string };
type ContactResponseBody = { ok: true } | { ok: false; error: string };

const FROM_EMAIL = "onboarding@resend.dev"; // sandbox Resend, no requiere dominio verificado
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ContactRequestBody>;
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const msg = body.msg?.trim() ?? "";

  if (!name || !email || !msg || !EMAIL_REGEX.test(email)) {
    const res: ContactResponseBody = { ok: false, error: "Datos inválidos." };
    return Response.json(res, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !toEmail) {
    const res: ContactResponseBody = {
      ok: false,
      error: "El servicio de contacto no está configurado.",
    };
    return Response.json(res, { status: 500 });
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `Nuevo mensaje de contacto de ${name}`,
    text: `De: ${name} <${email}>\n\n${msg}`,
  });

  if (error) {
    const res: ContactResponseBody = {
      ok: false,
      error: "No se pudo enviar el mensaje.",
    };
    return Response.json(res, { status: 500 });
  }

  const res: ContactResponseBody = { ok: true };
  return Response.json(res);
}
