variable "state_bucket_name" {
  description = "Globally unique state bucket name. Terragrunt sets this from the caller account id at runtime."
  type        = string
}
