// このモジュールを外部へ公開する窓口。
// 他の機能や画面はここに書かれているものだけを使い、モジュール内部のファイルを直接使わない。
export { contractService } from "@/modules/contract/service";
export { ContractTable } from "@/modules/contract/ui/contract-table";
export { ContractSearchForm } from "@/modules/contract/ui/contract-search-form";
export { ContractCreateForm } from "@/modules/contract/ui/contract-create-form";
export { PartyCombobox, type PartyComboboxOption } from "@/modules/contract/ui/party-combobox";
export {
  createContractAction,
  deleteContractAction,
  type ContractFormState,
  type DeleteContractFormState,
} from "@/modules/contract/actions";
export {
  CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  CONTRACT_SORT_FIELDS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUSES,
  type ContractDetail,
  type ContractSearchCriteria,
  type ContractSortField,
  type ContractStatus,
  type ContractSummary,
} from "@/modules/contract/types";
export {
  appendContractDeletedFlag,
  contractSearchQuerySchema,
  parseContractReturnTo,
  type ContractSearchQuery,
} from "@/modules/contract/validation";
