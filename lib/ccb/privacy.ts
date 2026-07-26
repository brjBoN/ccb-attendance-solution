import type { CcbIndividual } from "@/lib/ccb/types";
import { maskEmail, maskPhone } from "@/lib/utils";

export type PublicIndividualMatch = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  maskedEmail: string | null;
  maskedMobilePhone: string | null;
  maskedHomePhone: string | null;
  campus: string | null;
};

export function toPublicIndividualMatch(person: CcbIndividual): PublicIndividualMatch {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: person.fullName,
    maskedEmail: maskEmail(person.email),
    maskedMobilePhone: maskPhone(person.mobilePhone),
    maskedHomePhone: maskPhone(person.homePhone),
    campus: person.campus
  };
}
