import { request } from './http'
import type { BusinessTypeNode, City, Company, Department, Employee, Project } from '@/types/master'

export const getCompanies = () => request<Company[]>({ method: 'get', url: '/master/companies' })
export const getDepartments = () => request<Department[]>({ method: 'get', url: '/master/departments' })
export const getEmployees = () => request<Employee[]>({ method: 'get', url: '/master/employees' })
export const getCities = () => request<City[]>({ method: 'get', url: '/master/cities' })
export const getProjects = () => request<Project[]>({ method: 'get', url: '/master/projects' })
export const getBusinessTypes = () =>
  request<BusinessTypeNode[]>({ method: 'get', url: '/master/business-types/tree' })
