# Creates the remote state bucket. Local backend: including root.hcl would point
# this unit at the bucket it is creating.

include "provider" {
  path = find_in_parent_folders("provider.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  backend "local" {
    path = "${get_terragrunt_dir()}/terraform.tfstate"
  }
}
EOF
}

inputs = {
  state_bucket_name = local.env.locals.state_bucket_name
}
