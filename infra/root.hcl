# Remote state for every unit except infra/live/dev/state.
# That unit creates this bucket and keeps a local backend, so it does not include this file.
#
# Terragrunt allows one include level, so the provider block below is repeated
# from infra/provider.hcl. Keep the two copies on the same versions.

locals {
  env        = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  aws_region = local.env.locals.aws_region
}

terraform_version_constraint  = "= 1.13.2"
terragrunt_version_constraint = "= 1.1.6"

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = "= 1.13.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.70.0"
    }
  }
}

provider "aws" {
  region = "${local.aws_region}"
}
EOF
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  # The state unit owns the bucket. disable_init stops Terragrunt from creating it,
  # and disable_bucket_update stops Terragrunt from changing versioning, encryption,
  # or the bucket policy that the state unit manages.
  disable_init = true
  config = {
    bucket                = local.env.locals.state_bucket_name
    key                   = "${path_relative_to_include()}/tofu.tfstate"
    region                = local.env.locals.aws_region
    encrypt               = true
    use_lockfile          = true
    disable_bucket_update = true
  }
}
