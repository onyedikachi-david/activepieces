import { OAuth2PropertyValue, StoreScope, TriggerStrategy, createTrigger } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod, AuthenticationType, HttpRequest } from '@activepieces/pieces-common';

const KOMMO_LEAD_STATUS_WEBHOOK_STORE_KEY = 'kommo_lead_status_webhook_id';
const KOMMO_LEAD_STATUS_WEBHOOK_DESTINATION_STORE_KEY = 'kommo_lead_status_webhook_destination';

export const kommoLeadStatusChanged = createTrigger({
    name: 'lead_status_changed',
    displayName: 'Lead Status Changed',
    description: 'Fires when a lead changes its pipeline stage/status.',
    props: {
    },
    type: TriggerStrategy.WEBHOOK,
    sampleData: {
        "leads": [
            {
                "id": 54321,
                "status_id": "142",
                "old_status_id": "141",
                "pipeline_id": "1001",
                "updated_at": 1678886500,
            }
        ]
    },
    async onEnable(context) {
        const { store, auth, webhookUrl } = context;
        const { access_token, props } = auth as OAuth2PropertyValue;
        const accountSubdomain = props?.['account_subdomain'];

        if (!accountSubdomain) {
            throw new Error("Account subdomain is missing from connection.");
        }

        const requestBody = {
            destination: webhookUrl,
            settings: ['status_lead']
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
            // Store both Kommo's webhook ID and the destination URL we registered
            await store.put(KOMMO_LEAD_STATUS_WEBHOOK_STORE_KEY, response.body.id, StoreScope.FLOW);
            await store.put(KOMMO_LEAD_STATUS_WEBHOOK_DESTINATION_STORE_KEY, webhookUrl, StoreScope.FLOW);
            console.log(`Kommo webhook created for Lead Status Changed: ${response.body.id}, listening to ${webhookUrl}`);
        } else {
            console.error('Failed to create Kommo webhook for Lead Status Changed', response);
            throw new Error(`Failed to create Kommo webhook. Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
        }
    },
    async onDisable(context) {
        const { store, auth } = context;
        const { access_token, props } = auth as OAuth2PropertyValue;
        const accountSubdomain = props?.['account_subdomain'];
        const registeredWebhookUrl = await store.get<string>(KOMMO_LEAD_STATUS_WEBHOOK_DESTINATION_STORE_KEY, StoreScope.FLOW);

        if (accountSubdomain && registeredWebhookUrl) {
            const requestBody = {
                destination: registeredWebhookUrl
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
                    console.log(`Kommo webhook for destination ${registeredWebhookUrl} (Lead Status Changed) deleted successfully.`);
                } else {
                    console.warn(`Failed to delete Kommo webhook for ${registeredWebhookUrl} (Lead Status Changed). Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
                }
            } catch (error) {
                console.warn(`Error deleting Kommo webhook for ${registeredWebhookUrl} (Lead Status Changed):`, error);
            }
        }
        await store.delete(KOMMO_LEAD_STATUS_WEBHOOK_STORE_KEY, StoreScope.FLOW);
        await store.delete(KOMMO_LEAD_STATUS_WEBHOOK_DESTINATION_STORE_KEY, StoreScope.FLOW);
    },
    async run(context) {
        const payloadBody = context.payload.body;
        let statusChanges: unknown[] = [];

        if (payloadBody && typeof payloadBody === 'object') {
            if ('leads' in payloadBody) {
                const leadsData = (payloadBody as any).leads;
                if (leadsData && typeof leadsData === 'object' && 'status' in leadsData && Array.isArray(leadsData.status)) {
                    statusChanges = leadsData.status;
                } else if (Array.isArray(leadsData)) { // If 'leads' is directly an array of status change objects
                    statusChanges = leadsData;
                }
            } else if (Array.isArray(payloadBody)) { // If the root payload is an array
                 statusChanges = payloadBody;
            }
        }

        if (statusChanges.length > 0) {
            console.log(`Received ${statusChanges.length} lead status change(s) via Kommo webhook.`);
        }
        return statusChanges;
    },
});
