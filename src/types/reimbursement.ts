export interface AllocationSavePayload {
  companyId: number | null
  projectId: number | null
  allocationRatio: number
  allocationAmount: number
}

export interface SubsidyDaySavePayload {
  subsidyDate: string
  mealSelected: boolean
  mealAmount: number
  transportationSelected: boolean
  transportationAmount: number
  phoneSelected: boolean
  phoneAmount: number
}

export interface TripSavePayload {
  travelerId: number | null
  departCityId: number | null
  arriveCityId: number | null
  departDate: string
  arriveDate: string
  tripDescription: string
  subsidyDays: SubsidyDaySavePayload[]
}

export interface ReimbursementDraftPayload {
  reimbursementTitle: string
  reimburserId: number | null
  reimDepartmentId: number | null
  reimCompanyId: number | null
  businessTypeId: number | null
  businessTripReason: string
  remarks: string
  version: number | null
  trips: TripSavePayload[]
  allocations: AllocationSavePayload[]
}

export interface ReimbursementListItem {
  id: number
  reimNo: string
  status: 0 | 1 | 2 | 3
  statusName: string
  reimburserDisplay: string | null
  departmentDisplay: string | null
  reimCompanyName: string | null
  businessTypeName: string | null
  reimbursementTitle: string | null
  businessTripReason: string | null
  subsidyTotal: number
  creationTime: string
}

export interface ReimbursementAction {
  id: number
  reimNo: string
  status: 0 | 1 | 2 | 3
  statusName: string
}

export interface AllocationDetail {
  id: number
  companyId: number
  companyNo: string
  companyName: string
  projectId: number | null
  projectNo: string | null
  projectName: string | null
  allocationRatio: number
  allocationAmount: number
  rowOrder: number
}

export interface SubsidyDayDetail {
  id: number
  subsidyDate: string
  weekdayName: string
  cityId: number
  cityName: string
  mealStandardAmount: number
  transportationStandardAmount: number
  phoneStandardAmount: number
  mealSelected: boolean
  transportationSelected: boolean
  phoneSelected: boolean
  mealAmount: number
  transportationAmount: number
  phoneAmount: number
}

export interface SubsidyDetail {
  id: number
  subsidyDays: number
  applyAmount: number
  subsidyAmount: number
  mealAmount: number
  transportationAmount: number
  phoneAmount: number
  days: SubsidyDayDetail[]
}

export interface TripDetail {
  id: number
  travelerId: number
  travelerNo: string
  travelerName: string
  departCityId: number
  departCityName: string
  arriveCityId: number
  arriveCityName: string
  departDate: string
  arriveDate: string
  tripDescription: string
  subsidy: SubsidyDetail
}

export interface ReimbursementDetail {
  id: number
  reimNo: string
  status: 0 | 1 | 2 | 3
  statusName: string
  reimbursementTitle: string | null
  reimburserId: number | null
  reimburserNo: string | null
  reimburserName: string | null
  reimDepartmentId: number | null
  reimDepartmentNo: string | null
  reimDepartmentName: string | null
  reimCompanyId: number | null
  reimCompanyNo: string | null
  reimCompanyName: string | null
  businessTypeId: number | null
  businessTypeNo: string | null
  businessTypeName: string | null
  businessTripReason: string | null
  subsidyTotal: number
  mealAllowance: number
  transportationAllowance: number
  phoneAllowance: number
  remarks: string | null
  version: number
  creationTime: string
  updateTime: string
  trips: TripDetail[]
  allocations: AllocationDetail[]
}
