<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules<typeof form> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function submit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await authStore.login(form)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/reimbursements'
    router.replace(redirect)
  } catch {
    // Axios interceptor already shows the backend error message.
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="identity">
        <p>TRAVEL</p>
        <h1>差旅费用报销</h1>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="submit">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" autocomplete="username" placeholder="请输入" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            autocomplete="current-password"
            placeholder="请输入"
            show-password
            type="password"
          />
        </el-form-item>
        <el-button class="login-button" :loading="loading" type="primary" @click="submit">登录</el-button>
      </el-form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  align-items: center;
  display: grid;
  min-height: 100vh;
  padding: 24px;
  place-items: center;
}

.login-panel {
  background: var(--travel-surface);
  border: 1px solid var(--travel-border);
  border-radius: 8px;
  box-shadow: 0 20px 48px rgba(14, 36, 69, 0.1);
  display: grid;
  gap: 28px;
  max-width: 420px;
  padding: clamp(24px, 5vw, 42px);
  width: min(100%, 420px);
}

.identity p {
  color: var(--travel-accent);
  font-weight: 700;
  margin-bottom: 8px;
}

.identity h1 {
  font-size: 28px;
  font-weight: 700;
}

.login-button {
  margin-top: 8px;
  width: 100%;
}
</style>
