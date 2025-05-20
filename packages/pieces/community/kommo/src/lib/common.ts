import { DropdownState } from "@activepieces/pieces-framework";

export interface KommoLead {
    id: number;
    name?: string;
}

export interface KommoContact {
    id: number;
    name?: string; // Full name
    first_name?: string;
    last_name?: string;
}

export interface KommoCompany {
    id: number;
    name?: string;
}

export const KommoCommon = {
    handleDropdownSearchFailure: (message: string, error: any): DropdownState<any> => {
        console.error(message, error);
        return {
            disabled: true,
            options: [],
            placeholder: message,
        };
    }
};
