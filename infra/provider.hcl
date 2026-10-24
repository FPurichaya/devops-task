# AWS provider and version pins. The state unit includes this file directly.
# root.hcl repeats this generate block. Terragrunt allows only one include level.

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
