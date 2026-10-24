# One environment, dev, in eu-central-1.
# The state bucket name is devops-task-tfstate-<account id>.
# The account id is read from the caller identity at plan time and is not stored in git.

locals {
  aws_region  = "eu-central-1"
  name_prefix = "devops-task"

  state_bucket_name = "${local.name_prefix}-tfstate-${get_aws_account_id()}"
}
