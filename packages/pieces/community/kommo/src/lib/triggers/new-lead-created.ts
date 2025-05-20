import { OAuth2PropertyValue, StoreScope, TriggerStrategy, createTrigger } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod, AuthenticationType, HttpRequest } from '@activepieces/pieces-common';

const KOMMO_WEBHOOK_ID_STORE_KEY = 'kommo_new_lead_webhook_id';

export const kommoNewLeadCreated = createTrigger({
    name: 'new_lead_created',
    displayName: 'New Lead Created',
    description: 'Fires when a new lead is created in Kommo.',
    props: {},
    type: TriggerStrategy.WEBHOOK,
    sampleData: {
        "leads": [
            {
                "id": 12345,
                "name": "New Lead via Webhook",
                "status_id": 78910,
                "pipeline_id": 11121,
                "created_at": 1678886400,
            }
        ]
    },
    async onEnable(context) {
        const { store, auth, webhookUrl } = context;
        const { access_token, props } = auth as OAuth2PropertyValue;
        const accountSubdomain = props?.['account_subdomain'];

        if (!accountSubdomain) {
            throw new Error("Account subdomain is missing from connection. Please reconfigure the connection.");
        }

        const requestBody = {
            destination: webhookUrl,
            settings: ['add_lead']
        };

        const request: HttpRequest = {
            method: HttpMethod.POST,
            url: `https://${accountSubdomain}.kommo.com/api/v4/webhooks`,
            body: requestBody,
            authentication: {
                type: AuthenticationType.BEARER_TOKEN,
                token: access_token,
            },
            headers: { 'Content-Type': 'application/json' },
        };

        const response = await httpClient.sendRequest<{ id: string }>(request);

        if (response.status === 200 && response.body?.id) {
            await store.put(KOMMO_WEBHOOK_ID_STORE_KEY, response.body.id, StoreScope.FLOW);
            console.log(`Kommo webhook created for New Lead: ${response.body.id}, listening to ${webhookUrl}`);
        } else {
            console.error('Failed to create Kommo webhook for New Lead', response);
            throw new Error(`Failed to create Kommo webhook. Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
        }
    },
    async onDisable(context) {
        const { store, auth, webhookUrl } = context;
        const { access_token, props } = auth as OAuth2PropertyValue;
        const accountSubdomain = props?.['account_subdomain'];

        if (accountSubdomain && webhookUrl) {
            const requestBody = {
                destination: webhookUrl
            };
            const request: HttpRequest = {
                method: HttpMethod.DELETE,
                url: `https://${accountSubdomain}.kommo.com/api/v4/webhooks`,
                body: requestBody,
                authentication: {
                    type: AuthenticationType.BEARER_TOKEN,
                    token: access_token,
                },
                headers: { 'Content-Type': 'application/json' },
            };
            try {
                const response = await httpClient.sendRequest(request);
                if (response.status === 204) {
                    console.log(`Kommo webhook for destination ${webhookUrl} deleted successfully.`);
                } else {
                    console.warn(`Failed to delete Kommo webhook for ${webhookUrl}. Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
                }
            } catch (error) {
                console.warn(`Error deleting Kommo webhook for ${webhookUrl}:`, error);
            }
        }
        await store.delete(KOMMO_WEBHOOK_ID_STORE_KEY, StoreScope.FLOW);
    },
    async run(context) {
        const payloadBody = context.payload.body;
        // Kommo webhook payload for 'add_lead' typically is an object where
        // one of the properties (e.g., 'leads') contains an array of the items that were added.
        // Example structure from Kommo docs: { leads: { add: [ {lead_object_1}, {lead_object_2} ] } }
        // Or sometimes just { leads: [ {lead_object_1} ] }

        let newLeads: unknown[] = [];

        if (payloadBody && typeof payloadBody === 'object') {
            if ('leads' in payloadBody) {
                const leadsData = (payloadBody as any).leads;
                if (leadsData && typeof leadsData === 'object' && 'add' in leadsData && Array.isArray(leadsData.add)) {
                    newLeads = leadsData.add;
                } else if (Array.isArray(leadsData)) {
                    newLeads = leadsData;
                }
            } else if (Array.isArray(payloadBody)) {
                 newLeads = payloadBody;
            }
        }

        if (newLeads.length > 0) {
             console.log(`Received ${newLeads.length} new lead(s) via Kommo webhook.`);
        }
        return newLeads;
    },
});
