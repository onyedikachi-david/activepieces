import { Property, OAuth2PropertyValue, createAction } from "@activepieces/pieces-framework";
import { httpClient, HttpMethod, AuthenticationType, HttpRequest } from "@activepieces/pieces-common";
import { KommoCommon, KommoContact } from "../common";

export const kommoUpdateContact = createAction({
    name: 'update_contact',
    displayName: 'Update Contact',
    description: 'Updates an existing contact in Kommo.',
    props: {
        contact_id: Property.Dropdown({
            displayName: 'Contact ID',
            description: 'The ID of the contact to update. Choose from the list or map a custom ID.',
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
                    const request: HttpRequest<{ _embedded: { contacts: KommoContact[] } }> = {
                        method: HttpMethod.GET,
                        url: `https://${accountSubdomain}.kommo.com/api/v4/contacts`,
                        authentication: {
                            type: AuthenticationType.BEARER_TOKEN,
                            token: authValue.access_token,
                        },
                        queryParams: {
                            limit: '100',
                            order: 'updated_at:desc', // or 'name:asc'
                        }
                    };
                    const response = await httpClient.sendRequest(request);

                    if (response.status === 200 && response.body?._embedded?.contacts) {
                        return {
                            disabled: false,
                            options: response.body._embedded.contacts.map((contact: KommoContact) => ({
                                label: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || `Contact ID: ${contact.id}`,
                                value: contact.id,
                            })),
                        };
                    }
                    return KommoCommon.handleDropdownSearchFailure('Could not load contacts.', response);
                } catch (error) {
                    return KommoCommon.handleDropdownSearchFailure('Error fetching contacts.', error);
                }
            }
        }),
        name: Property.ShortText({
            displayName: 'New Full Name',
            required: false,
        }),
        first_name: Property.ShortText({
            displayName: 'New First Name',
            required: false,
        }),
        last_name: Property.ShortText({
            displayName: 'New Last Name',
            required: false,
        }),
        responsible_user_id: Property.Number({
            displayName: 'New Responsible User ID',
            description: 'The ID of the new user responsible for the contact.',
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
                id: Property.Number({ displayName: 'Tag ID to Add', required: false }),
                name: Property.ShortText({ displayName: 'Tag Name to Add', required: false })
            }
        }),
        tags_to_delete: Property.Array({
            displayName: 'Tags to Delete',
            description: 'Array of tags to delete. Provide either name or ID for each tag.',
            required: false,
            properties: {
                id: Property.Number({ displayName: 'Tag ID to Delete', required: false }),
                name: Property.ShortText({ displayName: 'Tag Name to Delete', required: false })
            }
        }),
    },
    async run(context) {
        const { auth, propsValue } = context;
        const accessToken = (auth as OAuth2PropertyValue).access_token;
        const accountSubdomain = (auth as OAuth2PropertyValue).props?.['account_subdomain'];
        const contactId = propsValue.contact_id;

        if (!accountSubdomain) {
            throw new Error("Account subdomain is missing from connection. Please reconfigure the connection.");
        }
        if (!contactId) {
            throw new Error("Contact ID is required.");
        }

        const updateData: Record<string, any> = {};

        if (propsValue.name !== undefined && propsValue.name !== null && propsValue.name !== '') updateData['name'] = propsValue.name;
        if (propsValue.first_name !== undefined && propsValue.first_name !== null && propsValue.first_name !== '') updateData['first_name'] = propsValue.first_name;
        if (propsValue.last_name !== undefined && propsValue.last_name !== null && propsValue.last_name !== '') updateData['last_name'] = propsValue.last_name;
        if (propsValue.responsible_user_id !== undefined && propsValue.responsible_user_id !== null) updateData['responsible_user_id'] = propsValue.responsible_user_id;

        if (propsValue.custom_fields_values && Array.isArray(propsValue.custom_fields_values) && propsValue.custom_fields_values.length > 0) {
            updateData['custom_fields_values'] = propsValue.custom_fields_values;
        }

        const finalEmbedded: Record<string, any[]> = {};
        const tagsToAdd = propsValue.tags_to_add as {id?: number, name?: string}[] | undefined;
        if (tagsToAdd && tagsToAdd.length > 0) {
            finalEmbedded['tags_to_add'] = tagsToAdd.map(tag => {
                const t: Record<string, any> = {};
                if (tag.id !== undefined) t['id'] = tag.id;
                else if (tag.name !== undefined) t['name'] = tag.name;
                return t;
            }).filter(t => Object.keys(t).length > 0);
        }

        const tagsToDelete = propsValue.tags_to_delete as {id?: number, name?: string}[] | undefined;
        if (tagsToDelete && tagsToDelete.length > 0) {
            finalEmbedded['tags_to_delete'] = tagsToDelete.map(tag => {
                const t: Record<string, any> = {};
                if (tag.id !== undefined) t['id'] = tag.id;
                else if (tag.name !== undefined) t['name'] = tag.name;
                return t;
            }).filter(t => Object.keys(t).length > 0);
        }

        if (Object.keys(finalEmbedded).length > 0) {
            updateData['_embedded'] = finalEmbedded;
        }

        const request: HttpRequest = {
            method: HttpMethod.PATCH,
            url: `https://${accountSubdomain}.kommo.com/api/v4/contacts/${contactId}`,
            body: updateData,
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
