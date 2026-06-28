<script setup lang="ts">
import { Database } from 'lucide-vue-next'
import { useChatStore } from '../../stores/chatStore'
import { useTreeStore } from '../../stores/treeStore'

const tree = useTreeStore()
const chat = useChatStore()
</script>

<template>
  <div class="empty-state">
    <div class="icon">
      <img src="/logo-removebg-preview.png" alt="TreefyIt" class="brand-logo" />
    </div>
    <h2 class="title">{{ chat.selectedKnowledgeBase ? '向当前知识库提问' : '直接开始对话' }}</h2>
    <p class="subtitle">
      {{ chat.selectedKnowledgeBase ? '左侧切换知识库，或在输入框里输入 @ 选择 / 取消知识库。上传和构建请前往 Build。' : (tree.hasKnowledgeBases ? '不带知识库也可以直接聊天；输入 @ 可以临时挂载某个知识库。' : tree.buildGuard.description) }}
    </p>
    <div v-if="chat.selectedKnowledgeBase" class="kb-pill">
      <Database :size="15" :stroke-width="2" aria-hidden="true" />
      <span>{{ chat.selectedKnowledgeBase.name }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-logo {
  display: block;
  height: 64px;
  width: auto;
}

.title {
  font-size: $font-size-title;
  font-weight: $font-weight-semibold;
  color: $color-text;
}

.subtitle {
  font-size: $font-size-md;
  color: $color-text-light;
}

.kb-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 9px 14px;
  border: 1px solid rgba($color-primary, 0.2);
  border-radius: 999px;
  background: $color-accent;
  font-size: $font-size-base;
  color: $color-primary;
}
</style>
