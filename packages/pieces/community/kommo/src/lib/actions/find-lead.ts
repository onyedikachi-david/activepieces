import { Property, OAuth2PropertyValue, createAction, DropdownState } from "@activepieces/pieces-framework";
import { httpClient, HttpMethod, AuthenticationType, HttpRequest, QueryParams } from "@activepieces/pieces-common";

// Define available 'with' options based on Kommo documentation
const availableWithOptions: { label: string, value: string }[] = [
    { label: 'Contacts', value: 'contacts' },
    { label: 'Loss Reason', value: 'loss_reason' },
    { label: 'Catalog Elements', value: 'catalog_elements' },
    { label: 'Is Price Modified by Robot', value: 'is_price_modified_by_robot' },
    { label: 'Only Deleted', value: 'only_deleted' },
    { label: 'Source ID', value: 'source_id' },
];

export const kommoFindLead = createAction({
    name: 'find_lead_by_id',
    displayName: 'Find Lead by ID',
    description: 'Retrieves the details of a specific lead by its ID.',
    props: {
        lead_id: Property.Number({
            displayName: 'Lead ID',
            description: 'The ID of the lead to retrieve.',
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
                    options: availableWithOptions,
                } as DropdownState<string>;
            }
        })
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

        const queryParams: QueryParams = {};
        if (propsValue.with_param && Array.isArray(propsValue.with_param) && propsValue.with_param.length > 0) {
            queryParams['with'] = propsValue.with_param.join(',');
        }

        const request: HttpRequest = {
            method: HttpMethod.GET,
            url: `https://${accountSubdomain}.kommo.com/api/v4/leads/${leadId}`,
            authentication: {
                type: AuthenticationType.BEARER_TOKEN,
                token: accessToken,
            },
            queryParams: queryParams,
            headers: {
                // Kommo API doc says: Content-Type: application/hal+json for successful GET
                // but httpClient usually handles Accept headers. For GET, Content-Type on request is not typical.
            },
        };

        const response = await httpClient.sendRequest(request);
        return response.body;
    },
});
