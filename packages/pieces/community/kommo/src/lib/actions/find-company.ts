import { Property, OAuth2PropertyValue, createAction, DropdownState } from "@activepieces/pieces-framework";
import { httpClient, HttpMethod, AuthenticationType, HttpRequest, QueryParams } from "@activepieces/pieces-common";

const companyAvailableWithOptions: { label: string; value: string }[] = [
    { label: 'Leads', value: 'leads' },
    { label: 'Contacts', value: 'contacts' },
    { label: 'Catalog Elements', value: 'catalog_elements' },
];

export const kommoFindCompany = createAction({
    name: 'find_company',
    displayName: 'Find Company',
    description: 'Finds companies by partial or full name. Returns a list of companies found.',
    props: {
        name_query: Property.ShortText({
            displayName: 'Name Query',
            description: 'Partial or full name of the company to search for.',
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
                    options: companyAvailableWithOptions,
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
            query: propsValue.name_query,
        };

        if (propsValue.with_param && Array.isArray(propsValue.with_param) && propsValue.with_param.length > 0) {
            queryParams['with'] = propsValue.with_param.join(',');
        }

        const request: HttpRequest = {
            method: HttpMethod.GET,
            url: `https://${accountSubdomain}.kommo.com/api/v4/companies`,
            authentication: {
                type: AuthenticationType.BEARER_TOKEN,
                token: accessToken,
            },
            queryParams: queryParams,
            headers: {},
        };

        const response = await httpClient.sendRequest(request);

        if (response.body && typeof response.body === 'object' && '_embedded' in response.body) {
            const embedded = (response.body as any)._embedded;
            if (embedded && typeof embedded === 'object' && 'companies' in embedded) {
                return embedded.companies; // Return the array of companies
            }
        }
        return []; // Return empty array if no companies found or unexpected structure
    },
});
