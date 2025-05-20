import { Property, OAuth2PropertyValue, createAction } from "@activepieces/pieces-framework";
import { httpClient, HttpMethod, AuthenticationType, HttpRequest } from "@activepieces/pieces-common";

export const kommoCreateLead = createAction({
    name: 'create_new_lead',
    displayName: 'Create New Lead',
    description: 'Adds a new lead to Kommo.',
    props: {
        name: Property.ShortText({
            displayName: 'Lead Name',
            required: true,
        }),
        price: Property.Number({
            displayName: 'Price',
            required: false,
        }),
        status_id: Property.Number({
            displayName: 'Status ID',
            description: 'The ID of the status (stage) the lead is in.',
            required: false,
        }),
        pipeline_id: Property.Number({
            displayName: 'Pipeline ID',
            description: 'The ID of the pipeline the lead belongs to.',
            required: false,
        }),
        responsible_user_id: Property.Number({
            displayName: 'Responsible User ID',
            description: 'The ID of the user responsible for the lead.',
            required: false,
        }),
        contact_ids: Property.Array({
            displayName: 'Contact IDs',
            description: 'An array of contact IDs to associate with the lead.',
            required: false,
            properties: {
                id: Property.Number({
                    displayName: 'Contact ID',
                    required: true,
                })
            }
        }),
        company_id: Property.Number({
            displayName: 'Company ID',
            description: 'The ID of the company to associate with the lead.',
            required: false,
        }),
        tags: Property.Array({
            displayName: 'Tags',
            description: 'An array of tag names to add to the lead.',
            required: false,
            properties: {
                name: Property.ShortText({
                    displayName: 'Tag Name',
                    required: true,
                })
            }
        }),
        custom_fields_values: Property.Json({
            displayName: 'Custom Fields',
            description: 'JSON array of custom field values, e.g., [{"field_id": 123, "values": [{"value": "data"}]}]',
            required: false,
            defaultValue: []
        }),
    },
    async run(context) {
        const { auth, propsValue } = context;
        const accessToken = (auth as OAuth2PropertyValue).access_token;
        const accountSubdomain = (auth as any)['props']['account_subdomain'];

        const leadData: Record<string, any> = {
            name: propsValue.name,
        };

        if (propsValue.price !== undefined) leadData["price"] = propsValue.price;
        if (propsValue.status_id !== undefined) leadData["status_id"] = propsValue.status_id;
        if (propsValue.pipeline_id !== undefined) leadData["pipeline_id"] = propsValue.pipeline_id;
        if (propsValue.responsible_user_id !== undefined) leadData["responsible_user_id"] = propsValue.responsible_user_id;

        const embedded: Record<string, any[]> = {};
        if (propsValue.contact_ids && propsValue.contact_ids.length > 0) {
            embedded["contacts"] = propsValue.contact_ids.map((contact: any) => ({ id: contact.id }));
        }
        if (propsValue.company_id !== undefined) {
            embedded["companies"] = [{ id: propsValue.company_id }];
        }
        if (propsValue.tags && propsValue.tags.length > 0) {
            embedded["tags"] = propsValue.tags.map((tag: any) => ({ name: tag.name }));
        }

        if (Object.keys(embedded).length > 0) {
            leadData["_embedded"] = embedded;
        }

        if (propsValue.custom_fields_values && Array.isArray(propsValue.custom_fields_values) && propsValue.custom_fields_values.length > 0) {
            leadData["custom_fields_values"] = propsValue.custom_fields_values;
        }

        const requestBody = [leadData];

        const request: HttpRequest = {
            method: HttpMethod.POST,
            url: `https://${accountSubdomain}.kommo.com/api/v4/leads`,
            body: requestBody,
            authentication: {
                type: AuthenticationType.BEARER_TOKEN,
                token: accessToken,
            },
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const response = await httpClient.sendRequest(request);
        return response.body;
    },
});
