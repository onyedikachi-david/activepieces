import { TriggerStrategy, createTrigger, Property } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";

interface ZagomailTagAddedPayload {
    event_type: string;
    subscriber?: {
        subscriber_uid: string;
        email: string;
    };
    tag_id?: string | number;
    list_uid?: string;
    timestamp?: string;
}

export const subscriberTaggedTrigger = createTrigger({
    auth: zagomailAuth,
    name: 'subscriber_tagged',
    displayName: 'Subscriber Tagged',
    description: 'Triggers when a specific tag is added to a subscriber.',
    props: {
        tag_id: Property.ShortText({
            displayName: 'Tag ID',
            description: "The ID of the tag to monitor (e.g., 'your_tag_id' from Zagomail).",
            required: true,
        })
    },
    sampleData: {
        event_type: 'tag-added',
        subscriber: {
            subscriber_uid: 'sub_123xyz',
            email: 'test@example.com',
        },
        tag_id: 'tag_abc456',
        list_uid: 'list_def789',
        timestamp: '2023-10-27T12:00:00Z',
    },
    type: TriggerStrategy.WEBHOOK,

    async onEnable(context) {
        const client = makeZagomailClient(context.auth);
        const requestBody = {
            publicKey: client.getPublicKey(),
            event_type: 'tag-added',
            target_url: context.webhookUrl,
            tagID: context.propsValue.tag_id,
        };

        try {
            const response = await client.makeRequest<{
                webhook: {
                    id: string;
                    event_type?: string;
                    target_url?: string;
                    tag_id?: string | number;
                };
            }>(
                HttpMethod.POST,
                'webhooks/create',
                undefined,
                requestBody
            );

            if (response.data && response.data.webhook && response.data.webhook.id) {
                const webhookId = response.data.webhook.id;
                await context.store.put(`_zagomail_subscriber_tagged_webhook_id_${context.propsValue.tag_id}`, webhookId);
                console.log(`Webhook created for subscriber_tagged (tag: ${context.propsValue.tag_id}). ID: ${webhookId}`);
            } else {
                let errorMsg = "Failed to create Zagomail webhook (tagged): Webhook ID or object missing.";
                if (!response.data) errorMsg = "Failed to create Zagomail webhook (tagged): response.data is undefined.";
                else if (!response.data.webhook) errorMsg = "Failed to create Zagomail webhook (tagged): response.data.webhook is undefined.";
                else if (!response.data.webhook.id) errorMsg = "Failed to create Zagomail webhook (tagged): response.data.webhook.id is undefined.";
                console.error(errorMsg, response.data);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error(`Error creating Zagomail webhook for subscriber_tagged (tag: ${context.propsValue.tag_id}):`, error);
            throw new Error(`Error creating Zagomail webhook (tagged): ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        }
    },

    async onDisable(context) {
        const webhookId = await context.store.get<string>(`_zagomail_subscriber_tagged_webhook_id_${context.propsValue.tag_id}`);
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
                console.log(`Webhook deleted for subscriber_tagged (tag: ${context.propsValue.tag_id}). ID: ${webhookId}`);
            } catch (error) {
                console.error(`Failed to delete Zagomail webhook (tagged, tag: ${context.propsValue.tag_id}, ID: ${webhookId}):`, error);
            }
        } else {
            console.log(`No webhook ID found in store for subscriber_tagged (tag: ${context.propsValue.tag_id}), skipping delete.`);
        }
    },

    async run(context) {
        const payload = context.payload.body as ZagomailTagAddedPayload;
        if (payload && payload.event_type === 'tag-added' && payload.tag_id == context.propsValue.tag_id) {
            return [payload];
        }
        return [];
    },
});
