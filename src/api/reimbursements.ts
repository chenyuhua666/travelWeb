import { request } from './http'
import type { PageResult } from '@/types/api'
import type {
  ReimbursementAction,
  ReimbursementDetail,
  ReimbursementDraftPayload,
  ReimbursementListItem,
} from '@/types/reimbursement'

export interface ReimbursementQuery {
  current: number
  size: number
  reimNo?: string
  title?: string
  reason?: string
  companyId?: number
  departmentId?: number
  reimburserId?: number
  businessTypeId?: number
}

export const getReimbursements = (params: ReimbursementQuery) =>
  request<PageResult<ReimbursementListItem>>({
    method: 'get',
    url: '/reimbursements',
    params,
  })

export const getReimbursement = (id: number) =>
  request<ReimbursementDetail>({
    method: 'get',
    url: `/reimbursements/${id}`,
  })

export const createDraft = (data: ReimbursementDraftPayload) =>
  request<ReimbursementDetail>({
    method: 'post',
    url: '/reimbursements/drafts',
    data,
  })

export const saveDraft = (id: number, data: ReimbursementDraftPayload) =>
  request<ReimbursementDetail>({
    method: 'put',
    url: `/reimbursements/${id}/draft`,
    data,
  })

export const submitReimbursement = (id: number) =>
  request<ReimbursementAction>({
    method: 'post',
    url: `/reimbursements/${id}/submit`,
  })

export const approveReimbursement = (id: number) =>
  request<ReimbursementAction>({
    method: 'post',
    url: `/reimbursements/${id}/approve`,
  })

export const withdrawReimbursement = (id: number) =>
  request<ReimbursementAction>({
    method: 'post',
    url: `/reimbursements/${id}/withdraw`,
  })

export const voidReimbursement = (id: number) =>
  request<ReimbursementAction>({
    method: 'post',
    url: `/reimbursements/${id}/void`,
  })

export const copyReimbursement = (id: number) =>
  request<ReimbursementDetail>({
    method: 'post',
    url: `/reimbursements/${id}/copy`,
  })

export const deleteReimbursement = (id: number) =>
  request<void>({
    method: 'delete',
    url: `/reimbursements/${id}`,
  })
