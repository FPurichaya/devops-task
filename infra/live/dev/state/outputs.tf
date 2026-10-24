output "bucket_name" {
  description = "Remote state bucket. The name includes the account id, which is not committed."
  value       = aws_s3_bucket.state.bucket
}

output "bucket_arn" {
  description = "ARN of the remote state bucket."
  value       = aws_s3_bucket.state.arn
}
