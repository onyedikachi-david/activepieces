import { Property, OAuth2PropertyValue, createAction } from "@activepieces/pieces-framework";
import { httpClient, HttpMethod, AuthenticationType, HttpRequest } from "@activepieces/pieces-common";

export const kommoCreateContact = createAction({
    name: 'create_new_contact',
    displayName: 'Create New Contact',
    description: 'Adds a new contact to Kommo.',
    props: {
        name: Property.ShortText({
            displayName: 'Full Name',
            description: "Contact's full name.",
            required: true,
        }),
        first_name: Property.ShortText({
            displayName: 'First Name',
            required: false,
        }),
        last_name: Property.ShortText({
            displayName: 'Last Name',
            required: false,
        }),
        responsible_user_id: Property.Number({
            displayName: 'Responsible User ID',
            description: 'The ID of the user responsible for the contact.',
            required: false,
        }),
        custom_fields_values: Property.Json({
            displayName: 'Custom Fields',
            description: 'JSON array of custom field values, e.g., [{"field_id": 123, "values": [{"value": "data"}]}]',
            required: false,
            defaultValue: []
        }),
        tags: Property.Array({
            displayName: 'Tags',
            description: 'An array of tags to associate with the contact. Provide name or ID for each tag.',
            required: false,
            properties: {
                id: Property.Number({
                    displayName: 'Tag ID',
                    required: false,
                }),
                name: Property.ShortText({
                    displayName: 'Tag Name',
                    required: false, // User can provide ID or Name
                })
            }
        }),
    },
    async run(context) {
        const { auth, propsValue } = context;
        const accessToken = (auth as OAuth2PropertyValue).access_token;
        const accountSubdomain = (auth as OAuth2PropertyValue).props?.['account_subdomain'];

        if (!accountSubdomain) {
            throw new Error("Account subdomain is missing from connection. Please reconfigure the connection.");
        }

        const contactData: Record<string, any> = {
            name: propsValue.name,
        };

        if (propsValue.first_name) contactData['first_name'] = propsValue.first_name;
        if (propsValue.last_name) contactData['last_name'] = propsValue.last_name;
        if (propsValue.responsible_user_id !== undefined) contactData['responsible_user_id'] = propsValue.responsible_user_id;

        if (propsValue.custom_fields_values && Array.isArray(propsValue.custom_fields_values) && propsValue.custom_fields_values.length > 0) {
            contactData['custom_fields_values'] = propsValue.custom_fields_values;
        }

        const embeddedTags: { id?: number; name?: string }[] = [];
        const tagsInput = propsValue.tags as {id?: number, name?: string}[] | undefined;
        if (tagsInput && tagsInput.length > 0) {
            tagsInput.forEach(tag => {
                const t: {id?: number, name?: string} = {};
                if (tag.id !== undefined) t.id = tag.id;
                else if (tag.name !== undefined) t.name = tag.name; // Ensure name is only added if id is not present

                if (Object.keys(t).length > 0) {
                    embeddedTags.push(t);
                }
            });
        }

        if (embeddedTags.length > 0) {
            contactData['_embedded'] = { tags: embeddedTags };
        }

        const requestBody = [contactData];

        const request: HttpRequest = {
            method: HttpMethod.POST,
            url: `https://${accountSubdomain}.kommo.com/api/v4/contacts`,
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
