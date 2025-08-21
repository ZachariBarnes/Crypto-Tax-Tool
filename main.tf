terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.27"
    }
  }

  required_version = ">= 0.14.9"
}

provider "aws" {
  region = local.region

  # Make it faster by skipping something
  skip_get_ec2_platforms      = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_credentials_validation = true
  skip_requesting_account_id  = true
}

locals {
  region  = "us-east-1" 
  account_id = data.aws_caller_identity.current.account_id
  env = { for tuple in regexall("(.*)=(.*)", file(".env")) : tuple[0] => replace(tuple[1],"\r","") }
  bucket_name = "tax-app-transactions"
}

data "aws_caller_identity" "current" {}

# Other Terraform Managed Files


## S3 bucket setup

resource "aws_s3_bucket" "bucket" {
  bucket = local.env.BUCKET_NAME
  acl    = "private"
  server_side_encryption_configuration {
    rule {
      bucket_key_enabled = false

      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

## DynamoDB 

resource "aws_dynamodb_table" "tax-app-requests" {
  name             = "tax-app-requests"
  hash_key         = "id"
  billing_mode   = "PAY_PER_REQUEST"
  attribute {
    name = "id"
    type = "S"
  }
}

## EventBridge

resource "aws_cloudwatch_event_rule" "start-tax-app-rule" {
  description= "Rule to trigger the ecs Task"
  event_bus_name= "default"
  event_pattern= jsonencode({
    account:[local.account_id],
    detail-type:["Start Tax-App"]
    })
  is_enabled=true
  name = "Start-Tax-App"
  tags = {
    "tax-app": ""
  }
}

#Event Targets
resource "aws_cloudwatch_event_target" "tax-app-events" {
  target_id = "tax-app-events"
  rule      = "${aws_cloudwatch_event_rule.start-tax-app-rule.name}"
  arn       = "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/events/tax-app-events"
}

resource "aws_cloudwatch_event_target" "tax-app-cluster" {
  target_id = "tax-app-cluster"
  rule      = "${aws_cloudwatch_event_rule.start-tax-app-rule.name}"
  arn       = "arn:aws:ecs:${local.region}:${local.account_id}:cluster/tax-app-cluster"
  role_arn = aws_iam_role.event_bridge_ecs_target_role.arn
  # role_arn  = aws_iam_role.ecs_task_execution_role.arn
  ecs_target {
    enable_ecs_managed_tags = true
    task_count          = 1
    task_definition_arn = "arn:aws:ecs:${local.region}:${local.account_id}:task-definition/${aws_ecs_task_definition.tax-app-ecs-task-definition.family}"
    launch_type             = "FARGATE"
    network_configuration {
     subnets          = [aws_subnet.pub_subnet.id] 
     security_groups  = [aws_security_group.ecs_sg.id] /*aws_security_group.ecs_sg.id*/
     assign_public_ip = true
    }
  }
  # TaskDefinitionARN= "arn:aws:ecs:${local.region}:${local.account_id}:task-definition/${aws_ecs_task_definition.tax-app-ecs-task-definition.familiy}"
}
  # targets = [
  #   {
  #     service = "ecs"
  #     task_arn = "arn:aws:ecs:${local.region}:${local.account_id}:task/start-tax-app"
  #   },
  #   {
  #     service = "cloudwatch"
  #     event_type = "StartTaxApp"
  #     log_stream_arn = "arn:aws:logs:${local.region}:${local.account_id}:events/Tax-App-Events"
  #   }
  # ]
## ECR

resource "aws_ecr_repository" "tax-app-repository" {
  name                 = "tax-app-repo"
  image_tag_mutability = "MUTABLE"
}

## ECS 

resource "aws_ecs_cluster" "tax-app-ecs-cluster" {
  name = "tax-app-cluster"
}

resource "aws_ecs_service" "tax-app-ecs-service" {
  name            = "tax-app-service"
  cluster         = aws_ecs_cluster.tax-app-ecs-cluster.id
  task_definition = aws_ecs_task_definition.tax-app-ecs-task-definition.arn
  launch_type     = "FARGATE"
  
  network_configuration {
     subnets          = [aws_subnet.pub_subnet.id] 
     security_groups  = [aws_security_group.ecs_sg.id] /*aws_security_group.ecs_sg.id*/
    assign_public_ip = true #Chsnge once working
  }
  desired_count = 0
}

resource "aws_cloudwatch_log_group" "tax-app-event-log-group" {
  name = "/aws/events/tax-app-events"

  tags = {
    Environment = "production"
    Application = "vidulum-tax-app"
  }
}

resource "aws_cloudwatch_log_group" "tax-app-log-group" {
  name = "tax-app-logs"

  tags = {
    Environment = "production"
    Application = "vidulum-tax-app"
  }
}

resource "aws_ecs_task_definition" "tax-app-ecs-task-definition" {
  family                   = "tax-app-task-definition"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  memory                   = "2048"
  cpu                      = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
 container_definitions = jsonencode([
    {
      name      = "vidulum-tax-app-container"
      image     = "${aws_ecr_repository.tax-app-repository.repository_url}:latest"
      cpu       = 512
      memory    = 2048
      essential = true
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          awslogs-group = aws_cloudwatch_log_group.tax-app-log-group.name,
          awslogs-region = "us-east-1",
          awslogs-stream-prefix = "ecs-tax-app"
        }
      }
      mountPoints = []
      portMappings = [
        {
          protocol = "tcp"
          containerPort = 8080
          hostPort      = 8080
        }
      ]
      volumesFrom = []
      tags = {}
      tags_all = {}
      environment = [
        {
          name  = "BUCKET_NAME"
          value = "${aws_s3_bucket.bucket.id}"
        },
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "SOURCE_EMAIL"
          value = local.env.SOURCE_EMAIL
        },
        {
          name  = "REQUEST_TABLE_NAME"
          value = local.env.REQUEST_TABLE_NAME
        },
        {
          name  = "REGION"
          value = local.env.REGION
        },
        {
          name  = "ACCESS_KEY"
          value = local.env.ACCESS_KEY
        },
        {
          name  = "SECRET_KEY"
          value = local.env.SECRET_KEY
        },
        {
          name  = "API_KEYS"
          value = local.env.API_KEYS
        },
        {
          name = "PORT"
          value = "8080"
        },
        {
          name = "API"
          value = "false"
        }

        ]
    },
  ])
}
