const trimValue = (value?: string | null) => String(value ?? "").trim();

const toPhoneList = (value?: string) =>
  trimValue(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const encodeForm = (payload: Record<string, string>) =>
  Object.entries(payload)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

export interface OrderAlertPayload {
  orderId: string;
  customerName: string;
  phone: string;
  total: number;
  itemCount: number;
  commune?: string;
  source: "online" | "local";
}

export const createOrderAlertMessage = (payload: OrderAlertPayload) => {
  const parts = [
    `New ${payload.source} order`,
    payload.orderId,
    `Customer: ${payload.customerName || "Unknown"}`,
    `Phone: ${payload.phone || "N/A"}`,
    `Items: ${payload.itemCount}`,
    `Total: ${Number(payload.total || 0).toLocaleString()} DZD`,
  ];

  if (payload.commune) {
    parts.push(`Area: ${payload.commune}`);
  }

  return parts.join(" | ");
};

export const createOrderWebhookCard = (payload: OrderAlertPayload) => ({
  text: "Velixa Neo order alert",
  blocks: [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `New ${payload.source} order`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Order ID*\n${payload.orderId}` },
        { type: "mrkdwn", text: `*Customer*\n${payload.customerName || "Unknown"}` },
        { type: "mrkdwn", text: `*Phone*\n${payload.phone || "N/A"}` },
        { type: "mrkdwn", text: `*Items*\n${payload.itemCount}` },
        { type: "mrkdwn", text: `*Total*\n${Number(payload.total || 0).toLocaleString()} DZD` },
        { type: "mrkdwn", text: `*Area*\n${payload.commune || "N/A"}` },
      ],
    },
  ],
});

export const createOrderAlertService = ({
  twilioAccountSid,
  twilioAuthToken,
  twilioFromNumber,
  twilioAdminNumber,
  twilioToNumbers,
  alertWebhookUrl,
}: {
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioAdminNumber?: string;
  twilioToNumbers?: string;
  alertWebhookUrl?: string;
}) => {
  const smsTargets = (() => {
    const singleAdminNumber = trimValue(twilioAdminNumber);
    if (singleAdminNumber) {
      return [singleAdminNumber];
    }

    return toPhoneList(twilioToNumbers);
  })();

  const smsReady =
    Boolean(trimValue(twilioAccountSid)) &&
    Boolean(trimValue(twilioAuthToken)) &&
    Boolean(trimValue(twilioFromNumber)) &&
    smsTargets.length > 0;

  const webhookReady = Boolean(trimValue(alertWebhookUrl));

  return {
    isConfigured() {
      return smsReady || webhookReady;
    },

    async sendOrderCreated(payload: OrderAlertPayload) {
      if (!smsReady && !webhookReady) {
        return { sent: false, providers: [] as string[] };
      }

      const providers: string[] = [];
      const tasks: Promise<unknown>[] = [];
      const message = createOrderAlertMessage(payload);

      if (smsReady) {
        const auth = Buffer.from(`${trimValue(twilioAccountSid)}:${trimValue(twilioAuthToken)}`).toString("base64");

        for (const to of smsTargets) {
          tasks.push(
            fetch(`https://api.twilio.com/2010-04-01/Accounts/${trimValue(twilioAccountSid)}/Messages.json`, {
              method: "POST",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: encodeForm({
                To: to,
                From: trimValue(twilioFromNumber),
                Body: message,
              }),
            }).then(async (response) => {
              if (!response.ok) {
                const body = await response.text();
                throw new Error(`Twilio SMS failed: ${response.status} ${body}`);
              }
            })
          );
        }

        providers.push("sms");
      }

      if (webhookReady) {
        tasks.push(
          fetch(trimValue(alertWebhookUrl), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(createOrderWebhookCard(payload)),
          }).then(async (response) => {
            if (!response.ok) {
              const body = await response.text();
              throw new Error(`Order webhook failed: ${response.status} ${body}`);
            }
          })
        );

        providers.push("webhook");
      }

      await Promise.all(tasks);
      return { sent: true, providers };
    },
  };
};
