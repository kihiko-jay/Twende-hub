import { Resend } from "resend";
import he from "he";
import config from "@/config.ts";

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn("Resend API key not configured; skipping email send.");
    return;
  }
  try {
    await resend.emails.send({
      from: `${config.emailFromName} <${config.emailFromAddress}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    // Email failures should never crash the main flow.
    // eslint-disable-next-line no-console
    console.error("Failed to send email", error);
  }
}

/** Escape a user-supplied string before embedding it in HTML. */
const e = (s: string | null | undefined): string => he.escape(s ?? "");

const baseStyles = {
  body: "margin:0;padding:0;background-color:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;",
  card: "max-width:600px;margin:24px auto;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;",
  header:
    "background-color:#4a6741;color:#f9fafb;padding:16px 24px;font-size:20px;font-weight:700;font-family:Georgia,serif;",
  content: "padding:24px;",
  table:
    "width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;color:#374151;border-top:1px solid #e5e7eb;",
  tableCell: "padding:8px 0;border-bottom:1px solid #e5e7eb;",
  button:
    "display:inline-block;margin-top:16px;padding:10px 18px;border-radius:9999px;background-color:#4a6741;color:#f9fafb;text-decoration:none;font-weight:600;font-size:14px;",
  footer:
    "max-width:600px;margin:0 auto 24px auto;font-size:11px;color:#6b7280;text-align:center;line-height:1.5;",
};

const FOOTER_DEFAULT = `You're receiving this because you have a TwendeHub account.
  Manage preferences any time at <a href="https://twendehub.com/profile" style="color:#4a6741;">twendehub.com/profile</a>.`;

function renderLayout(headerText: string, body: string, footer = FOOTER_DEFAULT): string {
  return `
  <html>
    <body style="${baseStyles.body}">
      <div style="${baseStyles.card}">
        <div style="${baseStyles.header}">${e(headerText)}</div>
        <div style="${baseStyles.content}">${body}</div>
      </div>
      <div style="${baseStyles.footer}">${footer}</div>
    </body>
  </html>
  `;
}

interface BookingConfirmationParams {
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  bookingType: string;
}

interface PaymentReceiptParams {
  eventTitle: string;
  amount: number;
  mpesaReceipt: string;
  type: string;
}

interface EventApprovedParams {
  eventTitle: string;
  eventId: number;
}

interface EventRejectedParams {
  eventTitle: string;
  reason: string;
}

interface VehicleBookingRequestParams {
  vehicleDesc: string;
  eventTitle: string;
  organizerName: string;
  notes?: string | null;
}

interface PhotographerBookingRequestParams {
  eventTitle: string;
  organizerName: string;
  notes?: string | null;
}

interface ActivityRequestJoinParams {
  activityType: string;
  activityDate: string;
  locationName: string;
  peopleJoined: number;
  maxPeople: number;
  requestUrl: string;
}

interface ActivityRequestConvertedParams {
  activityType: string;
  activityDate: string;
  locationName: string;
  eventUrl: string;
}

export function bookingConfirmationEmail(
  to: string,
  { eventTitle, eventDate, eventLocation, bookingType }: BookingConfirmationParams,
) {
  const subject = `Your booking is confirmed — ${e(eventTitle)}`;
  const body = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
      Thanks for booking with TwendeHub. Here are your event details:
    </p>
    <table style="${baseStyles.table}">
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;width:40%;">Event</td>
        <td style="${baseStyles.tableCell}">${e(eventTitle)}</td>
      </tr>
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;">Date</td>
        <td style="${baseStyles.tableCell}">${e(eventDate)}</td>
      </tr>
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;">Location</td>
        <td style="${baseStyles.tableCell}">${e(eventLocation)}</td>
      </tr>
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;">Booking type</td>
        <td style="${baseStyles.tableCell}">${e(bookingType)}</td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:13px;color:#4b5563;">
      You can view full details and updates on your TwendeHub dashboard.
    </p>
  `;
  return { to, subject, html: renderLayout("Your TwendeHub booking is confirmed", body) };
}

export function paymentReceiptEmail(
  to: string,
  { eventTitle, amount, mpesaReceipt, type }: PaymentReceiptParams,
) {
  const subject = "Payment confirmed — TwendeHub";
  const body = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
      We've received your payment for <strong>${e(eventTitle)}</strong>.
    </p>
    <table style="${baseStyles.table}">
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;width:40%;">Amount</td>
        <td style="${baseStyles.tableCell}">KES ${amount.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;">M-Pesa Receipt</td>
        <td style="${baseStyles.tableCell}">${e(mpesaReceipt) || "N/A"}</td>
      </tr>
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;">Payment for</td>
        <td style="${baseStyles.tableCell}">${e(type)}</td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:13px;color:#4b5563;">
      You can view this event and manage participants from your organiser dashboard.
    </p>
  `;
  return { to, subject, html: renderLayout("Your TwendeHub payment is confirmed", body) };
}

export function eventApprovedEmail(to: string, { eventTitle, eventId }: EventApprovedParams) {
  const subject = "Your event is live on TwendeHub!";
  const eventUrl = `https://twendehub.com/events/${eventId}`;
  const body = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
      Great news — your event <strong>${e(eventTitle)}</strong> has been approved and is now live on TwendeHub.
    </p>
    <a href="${eventUrl}" style="${baseStyles.button}">
      View Event
    </a>
  `;
  return { to, subject, html: renderLayout("Your event is now live", body) };
}

export function eventRejectedEmail(to: string, { eventTitle, reason }: EventRejectedParams) {
  const subject = "Update on your TwendeHub event submission";
  const body = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
      Your event <strong>${e(eventTitle)}</strong> was not approved at this time.
    </p>
    <p style="margin:0 0 12px 0;font-size:13px;color:#4b5563;">
      Reason: ${e(reason)}
    </p>
    <p style="margin:0;font-size:13px;color:#4b5563;">
      If you have questions or believe this is an error, please reach out to our team.
    </p>
  `;
  return { to, subject, html: renderLayout("Update on your event", body) };
}

export function vehicleBookingRequestEmail(
  to: string,
  { vehicleDesc, eventTitle, organizerName, notes }: VehicleBookingRequestParams,
) {
  const subject = "New vehicle booking request on TwendeHub";
  const body = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
      ${e(organizerName)} has requested your vehicle <strong>${e(vehicleDesc)}</strong> for
      the event <strong>${e(eventTitle)}</strong>.
    </p>
    ${notes ? `<p style="margin:0 0 12px 0;font-size:13px;color:#4b5563;">Notes from organiser: ${e(notes)}</p>` : ""}
    <p style="margin:0;font-size:13px;color:#4b5563;">
      Please log in to TwendeHub to review and confirm this booking.
    </p>
  `;
  return { to, subject, html: renderLayout("New vehicle booking request", body) };
}

export function photographerBookingRequestEmail(
  to: string,
  { eventTitle, organizerName, notes }: PhotographerBookingRequestParams,
) {
  const subject = "New photography booking request on TwendeHub";
  const body = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
      ${e(organizerName)} has requested your photography services for the event
      <strong>${e(eventTitle)}</strong>.
    </p>
    ${notes ? `<p style="margin:0 0 12px 0;font-size:13px;color:#4b5563;">Notes from organiser: ${e(notes)}</p>` : ""}
    <p style="margin:0;font-size:13px;color:#4b5563;">
      Please log in to TwendeHub to review and respond to this request.
    </p>
  `;
  return { to, subject, html: renderLayout("New photography booking request", body) };
}

export function activityRequestJoinEmail(
  to: string,
  { activityType, activityDate, locationName, peopleJoined, maxPeople, requestUrl }: ActivityRequestJoinParams,
) {
  const subject = `Someone joined your ${e(activityType)} plan`;
  const body = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
      Good news — someone just joined your <strong>${e(activityType)}</strong> plan at <strong>${e(locationName)}</strong>.
    </p>
    <table style="${baseStyles.table}">
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;width:40%;">When</td>
        <td style="${baseStyles.tableCell}">${e(activityDate)}</td>
      </tr>
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;">Where</td>
        <td style="${baseStyles.tableCell}">${e(locationName)}</td>
      </tr>
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;">People joined</td>
        <td style="${baseStyles.tableCell}">${peopleJoined} / ${maxPeople}</td>
      </tr>
    </table>
    <a href="${requestUrl}" style="${baseStyles.button}">
      View plan on Twende
    </a>
  `;
  const footer = "You're receiving this because you created an Instant Group Adventure on TwendeHub.";
  return { to, subject, html: renderLayout("Your Twende Instant Group Adventure is growing", body, footer) };
}

export function activityRequestConvertedEmail(
  to: string,
  { activityType, activityDate, locationName, eventUrl }: ActivityRequestConvertedParams,
) {
  const subject = `Your ${e(activityType)} plan is now a Twende event`;
  const body = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;">
      Your Instant Group Adventure for <strong>${e(activityType)}</strong> at <strong>${e(locationName)}</strong> now has enough people.
    </p>
    <p style="margin:0 0 12px 0;font-size:13px;color:#4b5563;">
      We&apos;ve created a Twende event so you can manage participants and share it easily.
    </p>
    <table style="${baseStyles.table}">
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;width:40%;">When</td>
        <td style="${baseStyles.tableCell}">${e(activityDate)}</td>
      </tr>
      <tr>
        <td style="${baseStyles.tableCell};font-weight:600;">Where</td>
        <td style="${baseStyles.tableCell}">${e(locationName)}</td>
      </tr>
    </table>
    <a href="${eventUrl}" style="${baseStyles.button}">
      View event on Twende
    </a>
  `;
  const footer = "You're receiving this because you created an Instant Group Adventure on TwendeHub.";
  return { to, subject, html: renderLayout("Your group is ready — event created", body, footer) };
}
