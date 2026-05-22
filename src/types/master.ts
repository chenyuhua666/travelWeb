export interface Company {
  id: number
  companyNo: string
  companyName: string
}

export interface Department {
  id: number
  departmentNo: string
  departmentName: string
}

export interface Employee {
  id: number
  employeeNo: string
  employeeName: string
  departmentId: number
  companyId: number
}

export interface City {
  id: number
  cityNo: string
  cityName: string
  cityType: 1 | 2 | 3
}

export interface Project {
  id: number
  projectNo: string
  projectName: string
}

export interface BusinessTypeNode {
  id: number
  businessTypeNo: string
  businessTypeName: string
  parentId: number | null
  leaf: boolean
  children: BusinessTypeNode[]
}
