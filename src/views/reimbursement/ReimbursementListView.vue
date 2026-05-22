<script setup lang="ts">
import { CopyDocument, Delete, DocumentChecked, EditPen, MoreFilled, Tickets } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  approveReimbursement,
  copyReimbursement,
  deleteReimbursement,
  getReimbursements,
  voidReimbursement,
  type ReimbursementQuery,
} from '@/api/reimbursements'
import { useMasterStore } from '@/stores/master'
import type { ReimbursementListItem } from '@/types/reimbursement'
import { money } from '@/utils/reimbursement'

const router = useRouter()
const masterStore = useMasterStore()
const loading = ref(false)
const rows = ref<ReimbursementListItem[]>([])
const total = ref(0)
const query = reactive<ReimbursementQuery>({
  current: 1,
  size: 10,
  reimNo: undefined,
  title: undefined,
  reason: undefined,
  companyId: undefined,
  departmentId: undefined,
  reimburserId: undefined,
  businessTypeId: undefined,
})

const treeProps = {
  label: 'businessTypeName',
  children: 'children',
  value: 'id',
}

function resetQuery() {
  Object.assign(query, {
    current: 1,
    size: query.size,
    reimNo: undefined,
    title: undefined,
    reason: undefined,
    companyId: undefined,
    departmentId: undefined,
    reimburserId: undefined,
    businessTypeId: undefined,
  })
  loadRows()
}

async function loadRows() {
  loading.value = true
  try {
    const page = await getReimbursements(query)
    rows.value = page.records
    total.value = page.total
  } finally {
    loading.value = false
  }
}

function search() {
  query.current = 1
  loadRows()
}

function openForm(row?: ReimbursementListItem) {
  router.push(row ? `/reimbursements/${row.id}` : '/reimbursements/new')
}

async function approve(row: ReimbursementListItem) {
  await ElMessageBox.confirm(`确认通过报销单 ${row.reimNo}？`, '审批通过', { type: 'warning' })
  await approveReimbursement(row.id)
  ElMessage.success('审批已通过')
  loadRows()
}

async function voidRow(row: ReimbursementListItem) {
  await ElMessageBox.confirm(`确认作废报销单 ${row.reimNo}？`, '作废报销单', { type: 'warning' })
  await voidReimbursement(row.id)
  ElMessage.success('报销单已作废')
  loadRows()
}

async function copyRow(row: ReimbursementListItem) {
  const copied = await copyReimbursement(row.id)
  ElMessage.success('已复制为新草稿')
  router.push(`/reimbursements/${copied.id}`)
}

async function deleteRow(row: ReimbursementListItem) {
  await ElMessageBox.confirm(`确认删除草稿 ${row.reimNo}？`, '删除报销单', { type: 'warning' })
  await deleteReimbursement(row.id)
  ElMessage.success('草稿已删除')
  loadRows()
}

function pageSizeChanged() {
  query.current = 1
  loadRows()
}

onMounted(async () => {
  await masterStore.load()
  loadRows()
})
</script>

<template>
  <section class="list-page">
    <el-form class="query-form" :model="query" label-width="104px">
      <el-form-item label="报销单号">
        <el-input v-model="query.reimNo" clearable placeholder="请输入" @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="标题">
        <el-input v-model="query.title" clearable placeholder="请输入" @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="事由">
        <el-input v-model="query.reason" clearable placeholder="请输入" @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="费用归属公司">
        <el-select v-model="query.companyId" clearable filterable placeholder="请选择">
          <el-option
            v-for="item in masterStore.companies"
            :key="item.id"
            :label="item.companyName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报销部门">
        <el-select v-model="query.departmentId" clearable filterable placeholder="请选择">
          <el-option
            v-for="item in masterStore.departments"
            :key="item.id"
            :label="item.departmentName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="报销人">
        <el-select v-model="query.reimburserId" clearable filterable placeholder="请选择">
          <el-option
            v-for="item in masterStore.employees"
            :key="item.id"
            :label="`${item.employeeName}[${item.employeeNo}]`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="业务类型">
        <el-tree-select
          v-model="query.businessTypeId"
          :data="masterStore.businessTypes"
          :props="treeProps"
          check-strictly
          clearable
          placeholder="请选择"
        />
      </el-form-item>
      <div class="query-actions">
        <el-button class="query-outline" @click="openForm()">新增</el-button>
        <el-button class="query-outline" @click="resetQuery">清除</el-button>
        <el-button class="query-search" type="primary" @click="search">搜索</el-button>
      </div>
    </el-form>

    <el-table v-loading="loading" border :data="rows" class="result-table">
      <el-table-column fixed="left" type="index" width="62">
        <template #header>
          <el-icon class="index-icon"><Tickets /></el-icon>
        </template>
      </el-table-column>
      <el-table-column fixed="left" label="操作" width="132">
        <template #default="{ row }">
          <div class="row-actions">
            <el-tooltip content="审批" placement="top">
              <el-dropdown :disabled="row.status !== 3" trigger="click">
                <el-button class="icon-action" link :disabled="row.status !== 3">
                  <el-icon><DocumentChecked /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="voidRow(row)">作废</el-dropdown-item>
                    <el-dropdown-item @click="approve(row)">通过</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-tooltip>
            <el-tooltip content="编辑" placement="top">
              <el-button
                class="icon-action"
                link
                :disabled="row.status !== 0"
                @click="openForm(row)"
              >
                <el-icon><EditPen /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="更多" placement="top">
              <el-dropdown trigger="click">
                <el-button class="icon-action" link>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :icon="CopyDocument" @click="copyRow(row)">复制</el-dropdown-item>
                    <el-dropdown-item :disabled="row.status !== 0" :icon="Delete" @click="deleteRow(row)">
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="报销单号" min-width="172">
        <template #default="{ row }">
          <span class="table-link" @click="openForm(row)">{{ row.reimNo }}</span>
        </template>
      </el-table-column>
      <el-table-column label="单据状态" min-width="112">
        <template #default="{ row }">
          <span class="status-text">{{ row.statusName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="单据类型" min-width="124">
        <template #default>差旅报销单</template>
      </el-table-column>
      <el-table-column prop="reimburserDisplay" label="报销人" min-width="176" show-overflow-tooltip />
      <el-table-column prop="departmentDisplay" label="报销部门" min-width="184" show-overflow-tooltip />
      <el-table-column prop="reimCompanyName" label="费用归属公司" min-width="188" show-overflow-tooltip />
      <el-table-column prop="businessTypeName" label="业务类型" min-width="150" show-overflow-tooltip />
      <el-table-column label="报销标题" min-width="230" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="table-link" @click="openForm(row)">{{ row.reimbursementTitle || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="businessTripReason" label="报销事由" min-width="220" show-overflow-tooltip />
      <el-table-column align="right" label="补助金额" min-width="116">
        <template #default="{ row }">{{ money(row.subsidyTotal) }}</template>
      </el-table-column>
      <el-table-column prop="creationTime" label="创建时间" min-width="172" show-overflow-tooltip />
    </el-table>

    <div class="pagination-wrap">
      <span class="muted">共{{ total }}条</span>
      <el-pagination
        v-model:current-page="query.current"
        v-model:page-size="query.size"
        background
        :page-sizes="[10, 20, 50, 100]"
        layout="sizes, prev, pager, next, jumper"
        :total="total"
        @current-change="loadRows"
        @size-change="pageSizeChanged"
      />
    </div>
  </section>
</template>

<style scoped>
.list-page {
  background: #fff;
  display: grid;
  gap: 10px;
  grid-template-rows: auto auto 1fr auto;
  min-height: 100vh;
  padding: 20px;
}

.query-form {
  display: grid;
  gap: 0 24px;
  grid-template-columns: repeat(4, minmax(280px, 1fr));
  margin: 0 auto 10px;
  max-width: 1580px;
  width: 100%;
}

.query-form :deep(.el-form-item) {
  align-items: center;
  margin-bottom: 10px;
}

.query-form :deep(.el-form-item__label) {
  color: #69778d;
  justify-content: flex-end;
  padding-right: 10px;
}

.query-form :deep(.el-form-item__content),
.query-form :deep(.el-input),
.query-form :deep(.el-select),
.query-form :deep(.el-tree-select) {
  min-width: 0;
  width: 100%;
}

.query-actions {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  min-height: 32px;
}

.query-actions :deep(.el-button) {
  border-radius: 4px;
  height: 32px;
  min-width: 64px;
}

.query-outline {
  border-color: #2f7cf6;
  color: #176ee8;
}

.query-search {
  min-width: 64px;
}

.result-table {
  align-self: start;
  width: 100%;
}

.result-table :deep(th.el-table__cell) {
  background: #f6f7f9;
  color: #1e2a3a;
  font-weight: 600;
}

.index-icon,
.status-text {
  color: #2f7cf6;
}

.row-actions {
  align-items: center;
  display: flex;
  gap: 8px;
}

.icon-action {
  color: #2f7cf6;
  font-size: 16px;
  height: 22px;
  padding: 0;
  width: 18px;
}

.icon-action.is-disabled {
  color: #c7d0dc;
}

.pagination-wrap {
  align-items: center;
  align-self: end;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  min-height: 60px;
}

@media (max-width: 1280px) {
  .query-form {
    grid-template-columns: repeat(2, minmax(280px, 1fr));
  }
}

@media (max-width: 720px) {
  .list-page {
    min-height: auto;
    padding: 12px;
  }

  .query-form {
    grid-template-columns: 1fr;
  }

  .query-actions {
    justify-content: stretch;
  }

  .query-actions :deep(.el-button) {
    flex: 1;
  }

  .pagination-wrap {
    justify-content: flex-start;
  }
}
</style>
