<script setup lang="ts">
import {
  CirclePlus,
  CopyDocument,
  Delete,
  EditPen,
  Refresh,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createDraft,
  getReimbursement,
  saveDraft,
  submitReimbursement,
} from '@/api/reimbursements'
import { useMasterStore } from '@/stores/master'
import type { City } from '@/types/master'
import type {
  AllocationSavePayload,
  ReimbursementDetail,
  ReimbursementDraftPayload,
  SubsidyDaySavePayload,
  TripSavePayload,
} from '@/types/reimbursement'
import {
  createRowKey,
  createSubsidyDays,
  dateRange,
  disabledFutureDate,
  formatDate,
  formatPercent,
  mealStandard,
  money,
  roundMoney,
} from '@/utils/reimbursement'

interface TripRow extends TripSavePayload {
  key: string
}

interface AllocationRow {
  key: string
  companyId: number | null
  projectId: number | null
  percent: number
  amount: number
}

const route = useRoute()
const router = useRouter()
const masterStore = useMasterStore()
const basicFormRef = ref<FormInstance>()
const tripFormRef = ref<FormInstance>()
const loading = ref(false)
const saving = ref(false)
const submitting = ref(false)
const initialized = ref(false)
const dirty = ref(false)
const currentId = ref<number | null>(null)
const reimNo = ref('')
const status = ref<0 | 1 | 2 | 3>(0)
const statusName = ref('草稿')
const savedDate = ref(formatDate(new Date()))
const sections = reactive({
  basic: true,
  trips: true,
  subsidy: true,
  total: true,
  allocations: true,
  remarks: true,
})

const form = reactive({
  reimbursementTitle: '',
  reimburserId: null as number | null,
  reimDepartmentId: null as number | null,
  reimCompanyId: null as number | null,
  businessTypeId: null as number | null,
  businessTripReason: '',
  remarks: '',
  trips: [] as TripRow[],
  allocations: [emptyAllocation()] as AllocationRow[],
})

const tripDialogVisible = ref(false)
const tripDialogIndex = ref<number | null>(null)
const tripDialogSeed = ref<TripRow | null>(null)
const tripDialog = reactive({
  travelerId: null as number | null,
  departCityId: null as number | null,
  arriveCityId: null as number | null,
  dates: [] as string[],
  tripDescription: '',
})

const subsidyDialogVisible = ref(false)
const subsidyTrip = ref<TripRow | null>(null)

const treeProps = {
  label: 'businessTypeName',
  children: 'children',
  value: 'id',
}

const basicRules: FormRules<typeof form> = {
  reimbursementTitle: [
    { required: true, message: '请输入报销标题', trigger: 'blur' },
    { max: 500, message: '报销标题不可超过500字', trigger: 'blur' },
  ],
  reimburserId: [{ required: true, message: '请选择报销人', trigger: 'change' }],
  reimDepartmentId: [{ required: true, message: '请选择报销部门', trigger: 'change' }],
  reimCompanyId: [{ required: true, message: '请选择费用归属公司', trigger: 'change' }],
  businessTypeId: [{ required: true, message: '请选择业务类型', trigger: 'change' }],
  businessTripReason: [
    { required: true, message: '请输入出差事由', trigger: 'blur' },
    { max: 500, message: '出差事由不可超过500字', trigger: 'blur' },
  ],
}

const tripRules: FormRules<typeof tripDialog> = {
  travelerId: [{ required: true, message: '请选择出行人', trigger: 'change' }],
  departCityId: [{ required: true, message: '请选择出发城市', trigger: 'change' }],
  arriveCityId: [{ required: true, message: '请选择到达城市', trigger: 'change' }],
  dates: [
    {
      validator: (_rule, value: string[], callback) => {
        if (!value || value.length !== 2) {
          callback(new Error('请选择出发到达日期'))
          return
        }
        const [departDate, arriveDate] = value
        if (!departDate || !arriveDate || arriveDate < departDate) {
          callback(new Error('到达日期不可早于出发日期'))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
  tripDescription: [
    { required: true, message: '请输入行程说明', trigger: 'blur' },
    { max: 500, message: '行程说明不可超过500字', trigger: 'blur' },
  ],
}

const readonly = computed(() => status.value !== 0)
const mealTotal = computed(() => sumAllowance('meal'))
const transportationTotal = computed(() => sumAllowance('transportation'))
const phoneTotal = computed(() => sumAllowance('phone'))
const subsidyTotal = computed(() => roundMoney(mealTotal.value + transportationTotal.value + phoneTotal.value))
const totalSelectedStandards = computed(() =>
  roundMoney(
    form.trips.reduce(
      (sum, trip) =>
        sum +
        trip.subsidyDays.reduce(
          (daySum, day) =>
            daySum +
            (day.mealSelected ? standardAmount(trip, 'meal') : 0) +
            (day.transportationSelected ? 40 : 0) +
            (day.phoneSelected ? 40 : 0),
          0,
        ),
      0,
    ),
  ),
)
const allocationPercentTotal = computed(() =>
  roundMoney(form.allocations.reduce((sum, row) => sum + Number(row.percent || 0), 0)),
)
const allocationAmountTotal = computed(() =>
  roundMoney(form.allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
)

function emptyAllocation(): AllocationRow {
  return {
    key: createRowKey('allocation'),
    companyId: null,
    projectId: null,
    percent: 100,
    amount: 0,
  }
}

function toggleSection(name: keyof typeof sections) {
  sections[name] = !sections[name]
}

function employeeLabel(id: number | null) {
  const employee = masterStore.employees.find((item) => item.id === id)
  return employee ? `${employee.employeeName}[${employee.employeeNo}]` : '-'
}

function cityLabel(id: number | null) {
  return masterStore.cities.find((item) => item.id === id)?.cityName || '-'
}

function selectedCity(trip: TripSavePayload) {
  return masterStore.cities.find((item) => item.id === trip.arriveCityId)
}

function standardAmount(trip: TripSavePayload, kind: 'meal' | 'transportation' | 'phone') {
  if (kind === 'meal') {
    return mealStandard(selectedCity(trip))
  }
  return 40
}

function sumAllowance(kind: 'meal' | 'transportation' | 'phone') {
  return roundMoney(
    form.trips.reduce(
      (sum, trip) =>
        sum +
        trip.subsidyDays.reduce((daySum, day) => {
          if (kind === 'meal') {
            return daySum + (day.mealSelected ? Number(day.mealAmount || 0) : 0)
          }
          if (kind === 'transportation') {
            return daySum + (day.transportationSelected ? Number(day.transportationAmount || 0) : 0)
          }
          return daySum + (day.phoneSelected ? Number(day.phoneAmount || 0) : 0)
        }, 0),
      0,
    ),
  )
}

function openTripDialog(mode: 'create' | 'edit' | 'copy', row?: TripRow, index?: number) {
  tripDialogIndex.value = mode === 'edit' && typeof index === 'number' ? index : null
  tripDialogSeed.value = row ? structuredClone(row) : null
  Object.assign(tripDialog, {
    travelerId: row?.travelerId ?? null,
    departCityId: row?.departCityId ?? null,
    arriveCityId: row?.arriveCityId ?? null,
    dates: row ? [row.departDate, row.arriveDate] : [],
    tripDescription: row?.tripDescription ?? '',
  })
  tripDialogVisible.value = true
  nextTick(() => tripFormRef.value?.clearValidate())
}

function hasTripOverlap(candidate: TripSavePayload, ignoredIndex: number | null) {
  return form.trips.some((trip, index) => {
    if (index === ignoredIndex || trip.travelerId !== candidate.travelerId) {
      return false
    }
    return !(trip.arriveDate < candidate.departDate || candidate.arriveDate < trip.departDate)
  })
}

async function confirmTrip() {
  await tripFormRef.value?.validate()
  const [departDate, arriveDate] = tripDialog.dates
  if (!departDate || !arriveDate) {
    return
  }
  const candidate: TripRow = {
    key: tripDialogSeed.value?.key || createRowKey('trip'),
    travelerId: tripDialog.travelerId,
    departCityId: tripDialog.departCityId,
    arriveCityId: tripDialog.arriveCityId,
    departDate,
    arriveDate,
    tripDescription: tripDialog.tripDescription.trim(),
    subsidyDays: [],
  }
  if (hasTripOverlap(candidate, tripDialogIndex.value)) {
    ElMessage.error('同一出行人的行程日期不可重复')
    return
  }
  const previous = tripDialogSeed.value
  const sameCalendar =
    previous &&
    previous.departDate === candidate.departDate &&
    previous.arriveDate === candidate.arriveDate &&
    previous.arriveCityId === candidate.arriveCityId
  candidate.subsidyDays = sameCalendar
    ? structuredClone(previous.subsidyDays)
    : createSubsidyDays(candidate.departDate, candidate.arriveDate, selectedCity(candidate))

  if (tripDialogIndex.value === null) {
    candidate.key = createRowKey('trip')
    form.trips.push(candidate)
  } else {
    form.trips.splice(tripDialogIndex.value, 1, candidate)
  }
  tripDialogVisible.value = false
  recalculateAllocations()
}

async function removeTrip(index: number) {
  await ElMessageBox.confirm('确认删除该补录行程？', '删除行程', { type: 'warning' })
  form.trips.splice(index, 1)
  recalculateAllocations()
}

function openSubsidyDialog(row: TripRow) {
  subsidyTrip.value = row
  subsidyDialogVisible.value = true
}

function rowChecked(day: SubsidyDaySavePayload) {
  return day.mealSelected && day.transportationSelected && day.phoneSelected
}

function columnChecked(kind: 'meal' | 'transportation' | 'phone') {
  const days = subsidyTrip.value?.subsidyDays || []
  if (!days.length) {
    return false
  }
  return days.every((day) => {
    if (kind === 'meal') {
      return day.mealSelected
    }
    if (kind === 'transportation') {
      return day.transportationSelected
    }
    return day.phoneSelected
  })
}

function allSubsidyChecked() {
  const days = subsidyTrip.value?.subsidyDays || []
  return days.length > 0 && days.every(rowChecked)
}

function setRowAllowance(day: SubsidyDaySavePayload, checked: boolean) {
  day.mealSelected = checked
  day.transportationSelected = checked
  day.phoneSelected = checked
}

function setColumnAllowance(kind: 'meal' | 'transportation' | 'phone', checked: boolean) {
  for (const day of subsidyTrip.value?.subsidyDays || []) {
    if (kind === 'meal') {
      day.mealSelected = checked
    } else if (kind === 'transportation') {
      day.transportationSelected = checked
    } else {
      day.phoneSelected = checked
    }
  }
}

function setAllAllowances(checked: boolean) {
  for (const day of subsidyTrip.value?.subsidyDays || []) {
    setRowAllowance(day, checked)
  }
}

function clampAllowance(day: SubsidyDaySavePayload, trip: TripSavePayload) {
  day.mealAmount = Math.min(Math.max(Number(day.mealAmount || 0), 0), standardAmount(trip, 'meal'))
  day.transportationAmount = Math.min(Math.max(Number(day.transportationAmount || 0), 0), 40)
  day.phoneAmount = Math.min(Math.max(Number(day.phoneAmount || 0), 0), 40)
  recalculateAllocations()
}

function addAllocation() {
  form.allocations.push({
    key: createRowKey('allocation'),
    companyId: null,
    projectId: null,
    percent: 0,
    amount: 0,
  })
  recalculateAllocations()
}

async function removeAllocation(index: number) {
  if (form.allocations.length === 1) {
    ElMessage.warning('至少保留一条分摊信息')
    return
  }
  await ElMessageBox.confirm('确认删除该分摊信息？', '删除分摊', { type: 'warning' })
  form.allocations.splice(index, 1)
  recalculateAllocations()
}

function changePercent(index: number) {
  const rowsAfterFirst = form.allocations.slice(1)
  const total = roundMoney(rowsAfterFirst.reduce((sum, row) => sum + Number(row.percent || 0), 0))
  if (total > 100) {
    const row = form.allocations[index]
    if (row) {
      row.percent = 0
    }
    ElMessage.warning('第二行起的分摊比例合计不可超过100%')
  }
  recalculateAllocations()
}

function recalculateAllocations() {
  if (!form.allocations.length) {
    form.allocations.push(emptyAllocation())
  }
  const firstRow = form.allocations[0]
  if (!firstRow) {
    return
  }
  const otherPercent = roundMoney(
    form.allocations.slice(1).reduce((sum, row) => sum + Number(row.percent || 0), 0),
  )
  firstRow.percent = roundMoney(Math.max(0, 100 - otherPercent))
  let otherAmount = 0
  form.allocations.slice(1).forEach((row) => {
    row.percent = roundMoney(Math.min(Math.max(Number(row.percent || 0), 0), 100))
    row.amount = roundMoney((subsidyTotal.value * row.percent) / 100)
    otherAmount += row.amount
  })
  firstRow.amount = roundMoney(Math.max(0, subsidyTotal.value - otherAmount))
}

function averageAllocations() {
  const rowCount = form.allocations.length
  if (!rowCount) {
    return
  }
  const regularPercent = roundMoney(100 / rowCount)
  form.allocations.forEach((row, index) => {
    if (index > 0) {
      row.percent = regularPercent
    }
  })
  recalculateAllocations()
}

function buildPayload(): ReimbursementDraftPayload {
  const allocations: AllocationSavePayload[] = form.allocations.map((row) => ({
    companyId: row.companyId,
    projectId: row.projectId,
    allocationRatio: Number((row.percent / 100).toFixed(6)),
    allocationAmount: roundMoney(row.amount),
  }))
  return {
    reimbursementTitle: form.reimbursementTitle,
    reimburserId: form.reimburserId,
    reimDepartmentId: form.reimDepartmentId,
    reimCompanyId: form.reimCompanyId,
    businessTypeId: form.businessTypeId,
    businessTripReason: form.businessTripReason,
    remarks: form.remarks,
    trips: form.trips.map(({ key: _key, ...trip }) => trip),
    allocations,
  }
}

function mapDetail(detail: ReimbursementDetail) {
  currentId.value = detail.id
  reimNo.value = detail.reimNo
  status.value = detail.status
  statusName.value = detail.statusName
  savedDate.value = formatDate(detail.updateTime || detail.creationTime)
  Object.assign(form, {
    reimbursementTitle: detail.reimbursementTitle || '',
    reimburserId: detail.reimburserId,
    reimDepartmentId: detail.reimDepartmentId,
    reimCompanyId: detail.reimCompanyId,
    businessTypeId: detail.businessTypeId,
    businessTripReason: detail.businessTripReason || '',
    remarks: detail.remarks || '',
    trips: detail.trips.map((trip) => ({
      key: createRowKey('trip'),
      travelerId: trip.travelerId,
      departCityId: trip.departCityId,
      arriveCityId: trip.arriveCityId,
      departDate: trip.departDate,
      arriveDate: trip.arriveDate,
      tripDescription: trip.tripDescription,
      subsidyDays: trip.subsidy.days.map((day) => ({
        subsidyDate: day.subsidyDate,
        mealSelected: day.mealSelected,
        mealAmount: Number(day.mealAmount),
        transportationSelected: day.transportationSelected,
        transportationAmount: Number(day.transportationAmount),
        phoneSelected: day.phoneSelected,
        phoneAmount: Number(day.phoneAmount),
      })),
    })),
    allocations: detail.allocations.length
      ? detail.allocations.map((allocation) => ({
          key: createRowKey('allocation'),
          companyId: allocation.companyId,
          projectId: allocation.projectId,
          percent: roundMoney(Number(allocation.allocationRatio) * 100),
          amount: Number(allocation.allocationAmount),
        }))
      : [emptyAllocation()],
  })
  recalculateAllocations()
  nextTick(() => {
    dirty.value = false
  })
}

async function persistDraft(showMessage = true) {
  saving.value = true
  try {
    const detail = currentId.value
      ? await saveDraft(currentId.value, buildPayload())
      : await createDraft(buildPayload())
    mapDetail(detail)
    if (route.name === 'reimbursement-create') {
      router.replace(`/reimbursements/${detail.id}`)
    }
    if (showMessage) {
      ElMessage.success('草稿已保存')
    }
    return detail
  } finally {
    saving.value = false
  }
}

async function validateSubmit() {
  await basicFormRef.value?.validate()
  if (!form.trips.length) {
    throw new Error('至少补录一条行程')
  }
  if (form.allocations.some((row) => !row.companyId)) {
    throw new Error('请补全费用分摊的费用归属')
  }
  recalculateAllocations()
  if (allocationPercentTotal.value !== 100) {
    throw new Error('分摊比例合计必须为100%')
  }
  if (allocationAmountTotal.value !== subsidyTotal.value) {
    throw new Error('分摊金额合计必须等于补助总金额')
  }
}

async function submitDocument() {
  try {
    await validateSubmit()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '请检查单据数据')
    return
  }
  submitting.value = true
  try {
    const detail = await persistDraft(false)
    await submitReimbursement(detail.id)
    await ElMessageBox.alert('提交成功', '提交报销单', { type: 'success' })
    router.push('/reimbursements')
  } finally {
    submitting.value = false
  }
}

async function closeDocument() {
  await ElMessageBox.confirm('关闭后未提交数据将自动保存为草稿，确认关闭？', '关闭单据', {
    type: 'warning',
  })
  if (!readonly.value && dirty.value) {
    await persistDraft(false)
    ElMessage.success('未提交数据已保留')
  }
  router.push('/reimbursements')
}

async function clearRemarks() {
  await ElMessageBox.confirm('确认删除备注信息？', '删除备注', { type: 'warning' })
  form.remarks = ''
}

async function loadDetail() {
  const id = Number(route.params.id)
  if (!id) {
    initialized.value = true
    recalculateAllocations()
    return
  }
  loading.value = true
  try {
    mapDetail(await getReimbursement(id))
  } finally {
    loading.value = false
    initialized.value = true
  }
}

watch(
  form,
  () => {
    if (initialized.value) {
      dirty.value = true
    }
  },
  { deep: true },
)

watch(subsidyTotal, recalculateAllocations)

watch(
  () => form.reimCompanyId,
  (companyId) => {
    const firstRow = form.allocations[0]
    if (companyId && firstRow && !firstRow.companyId) {
      firstRow.companyId = companyId
    }
  },
)

onMounted(async () => {
  await masterStore.load()
  await loadDetail()
})
</script>

<template>
  <main v-loading="loading" class="document-page">
    <header class="document-header">
      <div class="document-meta">
        <span>{{ reimNo || '草稿待编号' }}</span>
        <el-tag :type="status === 1 ? 'success' : status === 2 ? 'info' : status === 3 ? 'primary' : 'warning'">
          {{ statusName }}
        </el-tag>
      </div>
      <h1>差旅费用报销单</h1>
      <span>提单日期 {{ savedDate }}</span>
    </header>

    <article class="document-body">
      <section class="doc-section">
        <button class="section-band" type="button" @click="toggleSection('basic')">
          <span class="section-title">基础信息</span>
          <span>{{ sections.basic ? '收起' : '展开' }}</span>
        </button>
        <el-form
          v-show="sections.basic"
          ref="basicFormRef"
          class="basic-grid"
          :disabled="readonly"
          label-width="114px"
          :model="form"
          :rules="basicRules"
        >
          <el-form-item class="wide-field" label="报销标题" prop="reimbursementTitle">
            <el-input v-model="form.reimbursementTitle" maxlength="500" placeholder="请输入" show-word-limit />
          </el-form-item>
          <el-form-item label="报销人" prop="reimburserId">
            <el-select v-model="form.reimburserId" filterable placeholder="请选择">
              <el-option
                v-for="item in masterStore.employees"
                :key="item.id"
                :label="`${item.employeeName}[${item.employeeNo}]`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="报销部门" prop="reimDepartmentId">
            <el-select v-model="form.reimDepartmentId" filterable placeholder="请选择">
              <el-option
                v-for="item in masterStore.departments"
                :key="item.id"
                :label="`${item.departmentName}[${item.departmentNo}]`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="费用归属公司" prop="reimCompanyId">
            <el-select v-model="form.reimCompanyId" filterable placeholder="请选择">
              <el-option
                v-for="item in masterStore.companies"
                :key="item.id"
                :label="`${item.companyName}[${item.companyNo}]`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="业务类型" prop="businessTypeId">
            <el-tree-select
              v-model="form.businessTypeId"
              :data="masterStore.businessTypes"
              :props="treeProps"
              check-strictly
              placeholder="请选择"
            />
          </el-form-item>
          <el-form-item class="wide-field" label="出差事由" prop="businessTripReason">
            <el-input
              v-model="form.businessTripReason"
              maxlength="500"
              placeholder="请输入"
              resize="none"
              :rows="2"
              show-word-limit
              type="textarea"
            />
          </el-form-item>
        </el-form>
      </section>

      <section class="doc-section">
        <div class="section-band">
          <button class="section-title bare-title" type="button" @click="toggleSection('trips')">补录行程</button>
          <div class="section-actions">
            <el-button v-if="!readonly" link type="primary" :icon="CirclePlus" @click="openTripDialog('create')">
              补录行程
            </el-button>
            <el-button link @click="toggleSection('trips')">{{ sections.trips ? '收起' : '展开' }}</el-button>
          </div>
        </div>
        <el-table v-show="sections.trips" border :data="form.trips">
          <el-table-column type="index" label="序号" width="64" />
          <el-table-column label="出行人员" min-width="180">
            <template #default="{ row }">{{ employeeLabel(row.travelerId) }}</template>
          </el-table-column>
          <el-table-column label="出差日期" min-width="210">
            <template #default="{ row }">{{ row.departDate }} 至 {{ row.arriveDate }}</template>
          </el-table-column>
          <el-table-column label="行程" min-width="160">
            <template #default="{ row }">{{ cityLabel(row.departCityId) }} - {{ cityLabel(row.arriveCityId) }}</template>
          </el-table-column>
          <el-table-column prop="tripDescription" label="行程说明" min-width="220" show-overflow-tooltip />
          <el-table-column label="操作" width="182">
            <template #default="{ row, $index }">
              <el-tooltip content="删除">
                <el-button link :disabled="readonly" :icon="Delete" @click="removeTrip($index)" />
              </el-tooltip>
              <el-tooltip content="编辑">
                <el-button link :disabled="readonly" :icon="EditPen" @click="openTripDialog('edit', row, $index)" />
              </el-tooltip>
              <el-tooltip content="复制">
                <el-button link :disabled="readonly" :icon="CopyDocument" @click="openTripDialog('copy', row)" />
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="doc-section">
        <button class="section-band" type="button" @click="toggleSection('subsidy')">
          <span class="section-title">补助信息</span>
          <span>{{ sections.subsidy ? '收起' : '展开' }}</span>
        </button>
        <template v-if="sections.subsidy">
          <el-alert
            class="subsidy-tip"
            title="请根据实际出差日期选择补助；出差期间当日有用餐安排或用车的，请自行核减当日补助。"
            :closable="false"
            show-icon
            type="warning"
          />
          <el-table border :data="form.trips">
            <el-table-column type="index" label="序号" width="64" />
            <el-table-column label="出行人" min-width="150">
              <template #default="{ row }">{{ employeeLabel(row.travelerId) }}</template>
            </el-table-column>
            <el-table-column label="出差日期" min-width="210">
              <template #default="{ row }">{{ row.departDate }} 至 {{ row.arriveDate }}</template>
            </el-table-column>
            <el-table-column label="补助天数" width="110">
              <template #default="{ row }">{{ row.subsidyDays.length }}</template>
            </el-table-column>
            <el-table-column label="行程" min-width="150">
              <template #default="{ row }">{{ cityLabel(row.departCityId) }} - {{ cityLabel(row.arriveCityId) }}</template>
            </el-table-column>
            <el-table-column label="补助城市" min-width="120">
              <template #default="{ row }">{{ cityLabel(row.arriveCityId) }}</template>
            </el-table-column>
            <el-table-column align="right" label="申请金额" min-width="120">
              <template #default="{ row }">
                {{
                  money(
                    row.subsidyDays.reduce(
                      (sum: number, day: SubsidyDaySavePayload) =>
                        sum +
                        (day.mealSelected ? standardAmount(row, 'meal') : 0) +
                        (day.transportationSelected ? 40 : 0) +
                        (day.phoneSelected ? 40 : 0),
                      0,
                    ),
                  )
                }}
              </template>
            </el-table-column>
            <el-table-column align="right" label="补助金额" min-width="120">
              <template #default="{ row }">
                {{
                  money(
                    row.subsidyDays.reduce(
                      (sum: number, day: SubsidyDaySavePayload) =>
                        sum +
                        (day.mealSelected ? day.mealAmount : 0) +
                        (day.transportationSelected ? day.transportationAmount : 0) +
                        (day.phoneSelected ? day.phoneAmount : 0),
                      0,
                    ),
                  )
                }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="92">
              <template #default="{ row }">
                <el-tooltip content="编辑补助日历">
                  <el-button link :disabled="readonly" :icon="EditPen" @click="openSubsidyDialog(row)" />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </section>

      <section class="doc-section">
        <button class="section-band" type="button" @click="toggleSection('total')">
          <span class="section-title">费用合计</span>
          <span>{{ sections.total ? '收起' : '展开' }}</span>
        </button>
        <dl v-show="sections.total" class="totals">
          <div><dt>补助总金额</dt><dd>{{ money(subsidyTotal) }}</dd></div>
          <div><dt>餐费补助</dt><dd>{{ money(mealTotal) }}</dd></div>
          <div><dt>交通补助</dt><dd>{{ money(transportationTotal) }}</dd></div>
          <div><dt>通讯补助</dt><dd>{{ money(phoneTotal) }}</dd></div>
        </dl>
      </section>

      <section class="doc-section">
        <div class="section-band">
          <button class="section-title bare-title" type="button" @click="toggleSection('allocations')">
            费用归属及分摊
            <span class="section-note">分摊金额：{{ money(subsidyTotal) }}</span>
          </button>
          <div class="section-actions">
            <el-button v-if="!readonly" link type="primary" :icon="Refresh" @click="averageAllocations">均摊</el-button>
            <el-button link @click="toggleSection('allocations')">{{ sections.allocations ? '收起' : '展开' }}</el-button>
          </div>
        </div>
        <template v-if="sections.allocations">
          <el-table border :data="form.allocations">
            <el-table-column type="index" label="序号" width="64" />
            <el-table-column label="费用归属" min-width="260">
              <template #default="{ row }">
                <el-select v-model="row.companyId" :disabled="readonly" filterable placeholder="请选择">
                  <el-option
                    v-for="item in masterStore.companies"
                    :key="item.id"
                    :label="`${item.companyName}[${item.companyNo}]`"
                    :value="item.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="项目" min-width="240">
              <template #default="{ row }">
                <el-select v-model="row.projectId" :disabled="readonly" clearable filterable placeholder="请选择">
                  <el-option
                    v-for="item in masterStore.projects"
                    :key="item.id"
                    :label="`${item.projectName}[${item.projectNo}]`"
                    :value="item.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column align="right" label="分摊比例" min-width="180">
              <template #default="{ row, $index }">
                <el-input-number
                  v-if="$index > 0"
                  v-model="row.percent"
                  :disabled="readonly"
                  :max="100"
                  :min="0"
                  :precision="2"
                  controls-position="right"
                  @change="changePercent($index)"
                />
                <span v-else>{{ formatPercent(row.percent) }}</span>
              </template>
            </el-table-column>
            <el-table-column align="right" label="分摊金额" min-width="150">
              <template #default="{ row }">{{ money(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="{ $index }">
                <el-tooltip content="删除">
                  <el-button link :disabled="readonly" :icon="Delete" @click="removeAllocation($index)" />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
          <div class="allocation-add" v-if="!readonly">
            <el-button link type="primary" :icon="CirclePlus" @click="addAllocation">添加一行</el-button>
          </div>
          <div class="allocation-summary">
            <span>合计</span>
            <strong>{{ formatPercent(allocationPercentTotal) }}</strong>
            <strong>CNY {{ money(allocationAmountTotal) }}</strong>
          </div>
        </template>
      </section>

      <section class="doc-section">
        <div class="section-band">
          <button class="section-title bare-title" type="button" @click="toggleSection('remarks')">备注信息</button>
          <div class="section-actions">
            <el-button v-if="!readonly" link :icon="Delete" type="primary" @click="clearRemarks">删除备注</el-button>
            <el-button link @click="toggleSection('remarks')">{{ sections.remarks ? '收起' : '展开' }}</el-button>
          </div>
        </div>
        <el-input
          v-show="sections.remarks"
          v-model="form.remarks"
          :disabled="readonly"
          maxlength="1000"
          placeholder="请输入"
          resize="none"
          :rows="4"
          show-word-limit
          type="textarea"
        />
      </section>
    </article>

    <footer class="document-footer">
      <el-button @click="closeDocument">关闭</el-button>
      <el-button :disabled="readonly" :loading="saving" @click="persistDraft()">保存草稿</el-button>
      <el-button :disabled="readonly" :loading="submitting" type="primary" @click="submitDocument">提交</el-button>
    </footer>
  </main>

  <el-dialog v-model="tripDialogVisible" title="补录行程" width="min(820px, 94vw)">
    <el-alert
      class="dialog-tip"
      title="仅可补录未从申请单带入或未产生费用的行程信息；跨天跨城行程按到达城市匹配补助。"
      :closable="false"
      show-icon
      type="warning"
    />
    <el-form ref="tripFormRef" :model="tripDialog" :rules="tripRules" label-width="138px">
      <el-form-item label="出行人" prop="travelerId">
        <el-select v-model="tripDialog.travelerId" filterable placeholder="请选择">
          <el-option
            v-for="item in masterStore.employees"
            :key="item.id"
            :label="`${item.employeeName}[${item.employeeNo}]`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="出发城市" prop="departCityId">
        <el-select v-model="tripDialog.departCityId" filterable placeholder="请选择">
          <el-option v-for="item in masterStore.cities" :key="item.id" :label="item.cityName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="到达城市" prop="arriveCityId">
        <el-select v-model="tripDialog.arriveCityId" filterable placeholder="请选择">
          <el-option v-for="item in masterStore.cities" :key="item.id" :label="item.cityName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="出发到达日期" prop="dates">
        <el-date-picker
          v-model="tripDialog.dates"
          :disabled-date="disabledFutureDate"
          end-placeholder="到达日期"
          range-separator="-"
          start-placeholder="出发日期"
          type="daterange"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>
      <el-form-item label="行程说明" prop="tripDescription">
        <el-input
          v-model="tripDialog.tripDescription"
          maxlength="500"
          placeholder="请输入"
          resize="none"
          :rows="3"
          show-word-limit
          type="textarea"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="tripDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmTrip">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="subsidyDialogVisible" class="subsidy-dialog" title="补助日历" width="min(1240px, 96vw)">
    <div v-if="subsidyTrip" class="subsidy-calendar">
      <aside class="subsidy-aside">
        <div>
          <span class="muted">出差类型</span>
          <strong>{{ masterStore.businessTypes.length ? '差旅报销' : '-' }}</strong>
        </div>
        <div class="route-panel">
          <span>开始日期 {{ subsidyTrip.departDate }}</span>
          <strong>{{ cityLabel(subsidyTrip.departCityId) }} - {{ cityLabel(subsidyTrip.arriveCityId) }}</strong>
          <span>{{ dateRange(subsidyTrip.departDate, subsidyTrip.arriveDate).length }}天</span>
          <span>结束日期 {{ subsidyTrip.arriveDate }}</span>
        </div>
        <div class="amount-panel">
          <span>补助金额 <strong>CNY {{ money(sumAllowance('meal') + sumAllowance('transportation') + sumAllowance('phone')) }}</strong></span>
          <span>标准总额 <strong>CNY {{ money(totalSelectedStandards) }}</strong></span>
        </div>
      </aside>
      <div class="calendar-table">
        <div class="calendar-toolbar">
          <el-checkbox :model-value="allSubsidyChecked()" @change="setAllAllowances(Boolean($event))">
            全选
          </el-checkbox>
        </div>
        <el-table border :data="subsidyTrip.subsidyDays">
          <el-table-column label="出差日期" min-width="160">
            <template #default="{ row }">
              <div class="date-cell">
                <span>{{ row.subsidyDate }}</span>
                <el-checkbox :model-value="rowChecked(row)" @change="setRowAllowance(row, Boolean($event))" />
              </div>
            </template>
          </el-table-column>
          <el-table-column label="补助城市" min-width="120">
            <template #default>{{ cityLabel(subsidyTrip.arriveCityId) }}</template>
          </el-table-column>
          <el-table-column min-width="220">
            <template #header>
              <div class="allowance-head">
                <span>餐费补助</span>
                <el-checkbox
                  :model-value="columnChecked('meal')"
                  @change="setColumnAllowance('meal', Boolean($event))"
                />
              </div>
            </template>
            <template #default="{ row }">
              <div class="allowance-editor">
                <strong>CNY {{ money(standardAmount(subsidyTrip, 'meal')) }} / 天</strong>
                <el-checkbox v-model="row.mealSelected" @change="clampAllowance(row, subsidyTrip)" />
                <el-input-number
                  v-model="row.mealAmount"
                  :disabled="!row.mealSelected"
                  :max="standardAmount(subsidyTrip, 'meal')"
                  :min="0"
                  :precision="2"
                  controls-position="right"
                  @change="clampAllowance(row, subsidyTrip)"
                />
              </div>
            </template>
          </el-table-column>
          <el-table-column min-width="220">
            <template #header>
              <div class="allowance-head">
                <span>交通补助</span>
                <el-checkbox
                  :model-value="columnChecked('transportation')"
                  @change="setColumnAllowance('transportation', Boolean($event))"
                />
              </div>
            </template>
            <template #default="{ row }">
              <div class="allowance-editor">
                <strong>CNY 40.00 / 天</strong>
                <el-checkbox v-model="row.transportationSelected" @change="clampAllowance(row, subsidyTrip)" />
                <el-input-number
                  v-model="row.transportationAmount"
                  :disabled="!row.transportationSelected"
                  :max="40"
                  :min="0"
                  :precision="2"
                  controls-position="right"
                  @change="clampAllowance(row, subsidyTrip)"
                />
              </div>
            </template>
          </el-table-column>
          <el-table-column min-width="220">
            <template #header>
              <div class="allowance-head">
                <span>通讯补助</span>
                <el-checkbox
                  :model-value="columnChecked('phone')"
                  @change="setColumnAllowance('phone', Boolean($event))"
                />
              </div>
            </template>
            <template #default="{ row }">
              <div class="allowance-editor">
                <strong>CNY 40.00 / 天</strong>
                <el-checkbox v-model="row.phoneSelected" @change="clampAllowance(row, subsidyTrip)" />
                <el-input-number
                  v-model="row.phoneAmount"
                  :disabled="!row.phoneSelected"
                  :max="40"
                  :min="0"
                  :precision="2"
                  controls-position="right"
                  @change="clampAllowance(row, subsidyTrip)"
                />
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <template #footer>
      <el-button @click="subsidyDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="subsidyDialogVisible = false">确认</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.document-page {
  display: grid;
  gap: 16px;
  margin: 0 auto;
  max-width: 1200px;
  padding-bottom: 78px;
}

.document-header {
  align-items: center;
  background: var(--travel-surface);
  border-bottom: 1px solid var(--travel-border);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  min-height: 54px;
  padding: 0 18px;
  position: sticky;
  top: 0;
  z-index: 6;
}

.document-header h1 {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
}

.document-header > span {
  justify-self: end;
}

.document-meta {
  align-items: center;
  display: flex;
  gap: 10px;
}

.document-body {
  background: var(--travel-surface);
  border: 1px solid var(--travel-border);
  border-radius: 6px;
  display: grid;
  gap: 20px;
  padding: clamp(12px, 2vw, 20px);
}

.doc-section {
  display: grid;
  gap: 10px;
}

.section-band {
  border-bottom: 0;
  border-right: 0;
  border-top: 0;
  cursor: pointer;
  width: 100%;
}

.bare-title {
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0;
}

.section-actions {
  align-items: center;
  display: flex;
  gap: 4px;
}

.section-note {
  color: var(--travel-muted);
  font-size: 14px;
  font-weight: 400;
  margin-left: 8px;
}

.basic-grid {
  display: grid;
  gap: 2px 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 6px 4px 0;
}

.basic-grid :deep(.el-select),
.basic-grid :deep(.el-tree-select) {
  width: 100%;
}

.wide-field {
  grid-column: 1 / -1;
}

.subsidy-tip,
.dialog-tip {
  margin-bottom: 2px;
}

.totals {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 4px 18px;
}

.totals div {
  align-items: center;
  display: flex;
  gap: 18px;
}

.totals dt {
  color: var(--travel-muted);
}

.totals dd {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.allocation-add {
  border: 1px solid var(--travel-border);
  border-top: 0;
  display: flex;
  justify-content: center;
  min-height: 38px;
}

.allocation-summary {
  align-items: center;
  background: var(--travel-warning);
  border: 1px solid var(--travel-border);
  border-top: 0;
  display: grid;
  gap: 18px;
  grid-template-columns: 1fr 160px 180px;
  min-height: 42px;
  padding: 0 16px;
}

.allocation-summary strong {
  color: #fa6400;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  text-align: right;
}

.document-footer {
  align-items: center;
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--travel-border);
  bottom: 0;
  display: flex;
  gap: 10px;
  justify-content: center;
  left: 0;
  min-height: 64px;
  padding: 10px;
  position: fixed;
  right: 0;
  z-index: 8;
}

.subsidy-calendar {
  display: grid;
  gap: 18px;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 520px;
}

.subsidy-aside {
  border-right: 1px solid var(--travel-border);
  display: grid;
  gap: 18px;
  grid-auto-rows: max-content;
  padding-right: 18px;
}

.subsidy-aside > div:first-child,
.amount-panel {
  display: grid;
  gap: 10px;
}

.route-panel {
  border: 1px solid var(--travel-border);
  display: grid;
  gap: 14px;
  padding: 14px;
}

.route-panel strong {
  background: var(--travel-accent);
  color: #fff;
  padding: 8px;
}

.amount-panel strong,
.allowance-editor strong {
  color: #fa6400;
  font-weight: 500;
}

.calendar-table {
  min-width: 0;
}

.calendar-toolbar {
  display: flex;
  justify-content: flex-end;
  min-height: 30px;
}

.date-cell,
.allowance-head,
.allowance-editor {
  align-items: center;
  display: flex;
  gap: 10px;
}

.allowance-head {
  justify-content: center;
}

.allowance-editor {
  flex-wrap: wrap;
}

.allowance-editor :deep(.el-input-number) {
  width: 122px;
}

@media (max-width: 960px) {
  .document-header {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 12px;
    text-align: center;
  }

  .document-header > span,
  .document-meta {
    justify-self: center;
  }

  .basic-grid,
  .totals {
    grid-template-columns: 1fr;
  }

  .subsidy-calendar {
    grid-template-columns: 1fr;
  }

  .subsidy-aside {
    border-right: 0;
    padding-right: 0;
  }

  .allocation-summary {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 10px 16px;
  }

  .allocation-summary strong {
    text-align: left;
  }
}
</style>
