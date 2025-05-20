import { Property, OAuth2PropertyValue, createAction } from "@activepieces/pieces-framework";
import { httpClient, HttpMethod, AuthenticationType, HttpRequest } from "@activepieces/pieces-common";
import { KommoCommon, KommoLead } from "../common";

export const kommoUpdateLead = createAction({
    name: 'update_lead',
    displayName: 'Update Lead',
    description: 'Updates an existing lead in Kommo.',
    props: {
        lead_id: Property.Dropdown({
            displayName: 'Lead ID',
            description: 'The ID of the lead to update. Choose from the list or map a custom ID.',
            required: true,
            refreshers: [],
            options: async ({ auth }) => {
                if (!auth) {
                    return {
                        disabled: true,
                        options: [],
                        placeholder: 'Please authenticate first and connect your Kommo account.',
                    };
                }
                try {
                    const authValue = auth as OAuth2PropertyValue;
                    const accountSubdomain = authValue.props?.['account_subdomain'];

                    if (!accountSubdomain) {
                        return {
                            disabled: true,
                            options: [],
                            placeholder: 'Account subdomain is missing from connection.',
                        };
                    }

                    const request: HttpRequest<{ _embedded: { leads: KommoLead[] } }> = {
                        method: HttpMethod.GET,
                        url: `https://${accountSubdomain}.kommo.com/api/v4/leads`,
                        authentication: {
                            type: AuthenticationType.BEARER_TOKEN,
                            token: authValue.access_token,
                        },
                        queryParams: {
                            limit: '100', // Fetch up to 100 leads for the dropdown
                            order: 'updated_at:desc',
                        }
                    };
                    const response = await httpClient.sendRequest(request);

                    if (response.status === 200 && response.body?._embedded?.leads) {
                        return {
                            disabled: false,
                            options: response.body._embedded.leads.map((lead: KommoLead) => ({
                                label: lead.name || `Lead ID: ${lead.id}`,
                                value: lead.id,
                            })),
                        };
                    }
                    return KommoCommon.handleDropdownSearchFailure('Could not load leads.', response);
                } catch (error) {
                    return KommoCommon.handleDropdownSearchFailure('Error fetching leads.', error);
                }
            }
        }),
        name: Property.ShortText({
            displayName: 'New Lead Name',
            required: false,
        }),
        price: Property.Number({
            displayName: 'New Price',
            required: false,
        }),
        status_id: Property.Number({
            displayName: 'New Status ID',
            description: 'The ID of the new status (stage) for the lead.',
            required: false,
        }),
        pipeline_id: Property.Number({
            displayName: 'New Pipeline ID',
            description: 'The ID of the new pipeline for the lead.',
            required: false,
        }),
        responsible_user_id: Property.Number({
            displayName: 'New Responsible User ID',
            description: 'The ID of the new user responsible for the lead.',
            required: false,
        }),
        custom_fields_values: Property.Json({
            displayName: 'Custom Fields',
            description: 'JSON array of custom field values to update, e.g., [{"field_id": 123, "values": [{"value": "new_data"}]}]',
            required: false,
            defaultValue: []
        }),
        tags_to_add: Property.Array({
            displayName: 'Tags to Add',
            description: 'Array of tags to add. Provide either name or ID for each tag.',
            required: false,
            properties: {
                id: Property.Number({
                    displayName: 'Tag ID to Add',
                    required: false,
                }),
                name: Property.ShortText({
                    displayName: 'Tag Name to Add',
                    required: false,
                })
            }
        }),
        tags_to_delete: Property.Array({
            displayName: 'Tags to Delete',
            description: 'Array of tags to delete. Provide either name or ID for each tag.',
            required: false,
            properties: {
                id: Property.Number({
                    displayName: 'Tag ID to Delete',
                    required: false,
                }),
                name: Property.ShortText({
                    displayName: 'Tag Name to Delete',
                    required: false,
                })
            }
        }),
    },
    async run(context) {
        const { auth, propsValue } = context;
        const accessToken = (auth as OAuth2PropertyValue).access_token;
        const accountSubdomain = (auth as OAuth2PropertyValue).props?.['account_subdomain'];
        const leadId = propsValue.lead_id;

        if (!accountSubdomain) {
            throw new Error("Account subdomain is missing from connection. Please reconfigure the connection.");
        }
        if (!leadId) {
            throw new Error("Lead ID is required.");
        }

        const updateData: Record<string, any> = {};

        if (propsValue.name !== undefined && propsValue.name !== null && propsValue.name !== '') updateData['name'] = propsValue.name;
        if (propsValue.price !== undefined && propsValue.price !== null) updateData['price'] = propsValue.price;
        if (propsValue.status_id !== undefined && propsValue.status_id !== null) updateData['status_id'] = propsValue.status_id;
        if (propsValue.pipeline_id !== undefined && propsValue.pipeline_id !== null) updateData['pipeline_id'] = propsValue.pipeline_id;
        if (propsValue.responsible_user_id !== undefined && propsValue.responsible_user_id !== null) updateData['responsible_user_id'] = propsValue.responsible_user_id;

        if (propsValue.custom_fields_values && Array.isArray(propsValue.custom_fields_values) && propsValue.custom_fields_values.length > 0) {
            updateData['custom_fields_values'] = propsValue.custom_fields_values;
        }

        const finalEmbedded: Record<string, any[]> = {};
        const tagsToAdd = propsValue.tags_to_add as {id?: number, name?: string}[] | undefined;
        if (tagsToAdd && Array.isArray(tagsToAdd) && tagsToAdd.length > 0) {
            finalEmbedded['tags_to_add'] = tagsToAdd.map((tag: {id?: number, name?: string}) => {
                 const t: Record<string, any> = {};
                if (tag.id !== undefined && tag.id !== null) t['id'] = tag.id;
                else if (tag.name !== undefined && tag.name !== null && tag.name !== '') t['name'] = tag.name;
                return t;
            }).filter(t => Object.keys(t).length > 0);
        }

        const tagsToDelete = propsValue.tags_to_delete as {id?: number, name?: string}[] | undefined;
        if (tagsToDelete && Array.isArray(tagsToDelete) && tagsToDelete.length > 0) {
            finalEmbedded['tags_to_delete'] = tagsToDelete.map((tag: {id?: number, name?: string}) => {
                const t: Record<string, any> = {};
                if (tag.id !== undefined && tag.id !== null) t['id'] = tag.id;
                else if (tag.name !== undefined && tag.name !== null && tag.name !== '') t['name'] = tag.name;
                return t;
            }).filter(t => Object.keys(t).length > 0);
        }

        if (Object.keys(finalEmbedded).length > 0) {
            updateData['_embedded'] = finalEmbedded;
        }

        if (Object.keys(updateData).length === 0) {
            // No actual data to update, maybe return early or throw error?
            // For now, let it send an empty body if nothing is to be updated.
        }

        const request: HttpRequest = {
            method: HttpMethod.PATCH,
            url: `https://${accountSubdomain}.kommo.com/api/v4/leads/${leadId}`,
            body: updateData, // Single object for PATCH
            authentication: {
                type: AuthenticationType.BEARER_TOKEN,
                token: accessToken,
            },
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const response = await httpClient.sendRequest(request);
        // Kommo returns the updated lead object, or an array with one lead object within _embedded
        // For PATCH the response body example shows: _embedded.leads[0] which has id and updated_at
        // Let's return the whole body for now.
        return response.body;
    },
});
