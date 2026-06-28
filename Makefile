PROJECT_NAME := $(notdir $(CURDIR))
DATE := $(shell date +%Y%m%d)
DIST_DIR := dist
STAGE_DIR := $(DIST_DIR)/$(PROJECT_NAME)
ZIP_PATH := $(DIST_DIR)/$(PROJECT_NAME)-$(DATE).zip

CLEAN_PATHS := \
	node_modules \
	.vite \
	.vitest \
	coverage \
	dist

RSYNC_EXCLUDES := \
	--exclude node_modules \
	--exclude .vite \
	--exclude .vitest \
	--exclude coverage \
	--exclude dist \
	--exclude .DS_Store

.PHONY: help clean-package-artifacts dist-zip

help:
	@printf '%s\n' \
		'make clean-package-artifacts  # 清理 node_modules 和测试/构建产物' \
		'make dist-zip                 # 清理后打包当前目录为 dist/$(PROJECT_NAME)-$(DATE).zip'

clean-package-artifacts:
	rm -rf $(CLEAN_PATHS)

dist-zip: clean-package-artifacts
	mkdir -p $(DIST_DIR)
	rsync -a $(RSYNC_EXCLUDES) ./ $(STAGE_DIR)/
	cd $(DIST_DIR) && zip -rq $(PROJECT_NAME)-$(DATE).zip $(PROJECT_NAME)
	rm -rf $(STAGE_DIR)
	@printf 'created %s\n' "$(ZIP_PATH)"
