import { defineStore } from 'pinia'
import {
  getBusinessTypes,
  getCities,
  getCompanies,
  getDepartments,
  getEmployees,
  getProjects,
} from '@/api/master'
import type { BusinessTypeNode, City, Company, Department, Employee, Project } from '@/types/master'

export const useMasterStore = defineStore('master', {
  state: () => ({
    loaded: false,
    loading: false,
    companies: [] as Company[],
    departments: [] as Department[],
    employees: [] as Employee[],
    businessTypes: [] as BusinessTypeNode[],
    cities: [] as City[],
    projects: [] as Project[],
  }),
  actions: {
    async load() {
      if (this.loaded || this.loading) {
        return
      }
      this.loading = true
      try {
        const [companies, departments, employees, businessTypes, cities, projects] = await Promise.all([
          getCompanies(),
          getDepartments(),
          getEmployees(),
          getBusinessTypes(),
          getCities(),
          getProjects(),
        ])
        this.companies = companies
        this.departments = departments
        this.employees = employees
        this.businessTypes = businessTypes
        this.cities = cities
        this.projects = projects
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
  },
})
