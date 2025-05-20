import { Property, OAuth2PropertyValue, createAction, DropdownState } from "@activepieces/pieces-framework";
import { httpClient, HttpMethod, AuthenticationType, HttpRequest, QueryParams } from "@activepieces/pieces-common";

const contactAvailableWithOptions: { label: string; value: string }[] = [
    { label: 'Leads', value: 'leads' },
    { label: 'Catalog Elements', value: 'catalog_elements' },
];

export const kommoFindContact = createAction({
    name: 'find_contact_by_email',
    displayName: 'Find Contact by Email',
    description: 'Looks up contacts that match a specific email address. Returns a list of contacts found.',
    props: {
        email: Property.ShortText({
            displayName: 'Email Address',
            description: 'The email address to search for.',
            required: true,
        }),
        with_param: Property.MultiSelectDropdown({
            displayName: 'Include Related Entities (With)',
            description: 'Select which related entities to include in the response.',
            required: false,
            refreshers: [],
            options: async () => {
                return {
                    disabled: false,
                    options: contactAvailableWithOptions,
                } as DropdownState<string>;
            }
        })
    },
    async run(context) {
        const { auth, propsValue } = context;
        const accessToken = (auth as OAuth2PropertyValue).access_token;
        const accountSubdomain = (auth as OAuth2PropertyValue).props?.['account_subdomain'];

        if (!accountSubdomain) {
            throw new Error("Account subdomain is missing from connection. Please reconfigure the connection.");
        }

        const queryParams: QueryParams = {
            query: propsValue.email, // Use the email for the general query parameter
        };

        if (propsValue.with_param && Array.isArray(propsValue.with_param) && propsValue.with_param.length > 0) {
            queryParams['with'] = propsValue.with_param.join(',');
        }

        const request: HttpRequest = {
            method: HttpMethod.GET,
            url: `https://${accountSubdomain}.kommo.com/api/v4/contacts`,
            authentication: {
                type: AuthenticationType.BEARER_TOKEN,
                token: accessToken,
            },
            queryParams: queryParams,
            headers: {},
        };

        const response = await httpClient.sendRequest(request);
        // response.body should be an object like { _embedded: { contacts: [] } } or empty if no match
        // The action should ideally return the array of contacts directly
        if (response.body && typeof response.body === 'object' && '_embedded' in response.body) {
            const embedded = (response.body as any)._embedded;
            if (embedded && typeof embedded === 'object' && 'contacts' in embedded) {
                return embedded.contacts; // Return the array of contacts
            }
        }
        return []; // Return empty array if no contacts found or unexpected structure
    },
});
