
output "REQUEST_TABLE_NAME" {
  value = local.env.REQUEST_TABLE_NAME
}

output "REGION" {
  value = local.env.REGION
}

output "ACCESS_KEY" {
  value = local.env.ACCESS_KEY
}
  
output "SECRET_KEY" {
  value = local.env.SECRET_KEY
}

output "API_KEYS" {
  value = local.env.API_KEYS
}

output "SOURCE_EMAIL" {
  value = local.env.SOURCE_EMAIL
}

output "BUCKET_NAME" {
  value = "${aws_s3_bucket.bucket.id}"
}
  
output "PORT" {
  value = "8080"
}

output "NODE_ENV" {
  value = "production"
}
  
output "API" {
  value = true
}

output "ACCOUNT_ID" {
  value = local.account_id
}

output "LambdaRoleArn" {
  value = "${aws_iam_role.lambda_execution_role.arn}"
}

output "security_group_id" {
  value = aws_security_group.ecs_sg.id
}

output "subnet_id" {
  value = aws_subnet.pub_subnet.id
}
//For Debugging Only
/* output "tax_app_repository_url" {
  value = aws_ecr_repository.tax-app-repository.repository_url
}

output "ecr_registry_id" {
  value = aws_ecr_repository.tax-app-repository.registry_id
}

output "tax_app_ecr_arn" {
  value = aws_ecr_repository.tax-app-repository.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task_execution_role.arn
}

output aws_cloudwatch_log_group_name {
  value = aws_cloudwatch_log_group.tax-app-log-group.name
}
output "bucket_name" {
  value = aws_s3_bucket.bucket.id
}

output "ecs_cluster_id" {
  value = aws_ecs_cluster.tax-app-ecs-cluster.id
}
  
output "ecs_cluster_name" {
  value = aws_ecs_cluster.tax-app-ecs-cluster.name
}

  
output "ecs_cluster_arn" {
  value = aws_ecs_cluster.tax-app-ecs-cluster.arn
}

# output "subnet_id" {
#   value = aws_subnet.pub_subnet.id
# }

# output "security_group_id" {
#   value = aws_security_group.ecs_sg.id
# }

output "aws_ecs_task_definition" {
  value = aws_ecs_task_definition.tax-app-ecs-task-definition.id
} */
