import { TriggerStrategy, createTrigger } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";

interface ZagomailUnsubscribePayload {
    event_type: string;
    subscriber?: {
        subscriber_uid: string;
        email: string;
    };
    list_uid?: string;
    timestamp?: string;
}

export const subscriberUnsubscribedTrigger = createTrigger({
    auth: zagomailAuth,
    name: 'subscriber_unsubscribed',
    displayName: 'Subscriber Unsubscribed',
    description: 'Triggers when a subscriber unsubscribes from a list.',
    props: {},
    sampleData: {
        event_type: 'subscriber-unsubscribe',
        subscriber: {
            subscriber_uid: 'sub_123xyz',
            email: 'test@example.com',
        },
        list_uid: 'list_abc789',
        timestamp: '2023-10-27T11:00:00Z',
    },
    type: TriggerStrategy.WEBHOOK,

    async onEnable(context) {
        const client = makeZagomailClient(context.auth);
        const requestBody = {
            publicKey: client.getPublicKey(),
            event_type: 'subscriber-unsubscribe',
            target_url: context.webhookUrl,
        };

        try {
            const response = await client.makeRequest<{
                webhook: {
                    id: string;
                    event_type?: string;
                    target_url?: string;
                };
            }>(
                HttpMethod.POST,
                'webhooks/create',
                undefined,
                requestBody
            );

            if (response.data && response.data.webhook && response.data.webhook.id) {
                const webhookId = response.data.webhook.id;
                await context.store.put('_zagomail_subscriber_unsubscribed_webhook_id', webhookId);
                console.log(`Webhook created for subscriber_unsubscribed. ID: ${webhookId}`);
            } else {
                let errorMsg = "Failed to create Zagomail webhook (unsubscribe): Webhook ID or object missing.";
                if (!response.data) errorMsg = "Failed to create Zagomail webhook (unsubscribe): response.data is undefined.";
                else if (!response.data.webhook) errorMsg = "Failed to create Zagomail webhook (unsubscribe): response.data.webhook is undefined.";
                else if (!response.data.webhook.id) errorMsg = "Failed to create Zagomail webhook (unsubscribe): response.data.webhook.id is undefined.";
                console.error(errorMsg, response.data);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error("Error creating Zagomail webhook for subscriber_unsubscribed:", error);
            throw new Error(`Error creating Zagomail webhook (unsubscribe): ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        }
    },

    async onDisable(context) {
        const webhookId = await context.store.get<string>('_zagomail_subscriber_unsubscribed_webhook_id');
        if (webhookId) {
            const client = makeZagomailClient(context.auth);
            const requestBody = { publicKey: client.getPublicKey() };
            try {
                await client.makeRequest(
                    HttpMethod.POST,
                    `webhooks/delete?id=${webhookId}`,
                    undefined,
                    requestBody
                );
                console.log(`Webhook deleted for subscriber_unsubscribed. ID: ${webhookId}`);
            } catch (error) {
                console.error(`Failed to delete Zagomail webhook (unsubscribe, ID: ${webhookId}):`, error);
            }
        } else {
            console.log("No webhook ID found in store for subscriber_unsubscribed, skipping delete.");
        }
    },

    async run(context) {
        const payload = context.payload.body as ZagomailUnsubscribePayload;

        if (payload && payload.event_type === 'subscriber-unsubscribe') {
            return [payload];
        }
        return [];
    },
});
