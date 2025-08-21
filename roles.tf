resource "aws_ecr_repository_policy" "tax-app-repo-policy" {
  repository = aws_ecr_repository.tax-app-repository.name
  policy     = <<EOF
  {
    "Version": "2008-10-17",
    "Statement": [
      {
        "Sid": "adds full ecr access to the demo repository",
        "Effect": "Allow",
        "Principal": "*",
        "Action": [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetLifecyclePolicy",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
      }
    ]
  }
  EOF
}


 # ECS task execution role data
 data "aws_iam_policy_document" "ecs_task_execution_role" {
   version = "2012-10-17"
   statement {
     sid = ""
     effect = "Allow"
     actions = ["sts:AssumeRole"]

     principals {
       type        = "Service"
       identifiers = ["ecs-tasks.amazonaws.com"]
     }
   }
 }

 # ECS task execution role
 resource "aws_iam_role" "ecs_task_execution_role" {
   name               = var.ecs_task_execution_role_name
   assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_role.json
   managed_policy_arns   = [
    "arn:aws:iam::${local.account_id}:policy/service-role/${aws_iam_policy.event_bridge_ecs_task_policy.name}",
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    ]
 }

 #Eventbridge ECS Target Role
 resource "aws_iam_role" "event_bridge_ecs_target_role" {
   name               = "Amazon_EventBridge_Invoke_ECS_StartTaxService"
   path               = "/service-role/"
   assume_role_policy = jsonencode({
    Statement = [
        {
            Action    = "sts:AssumeRole"
            Effect    = "Allow"
            Principal = {
                Service = "events.amazonaws.com"
              }
          },
      ] 
    Version   = "2012-10-17"
  })
}

#EventBridge ECS Target managed Policy
resource "aws_iam_policy" "event_bridge_ecs_target_managed_policy" {
  name = aws_iam_role.event_bridge_ecs_target_role.name
  # arn       = "arn:aws:iam::${local.account_id}:policy/service-role/${aws_iam_role.event_bridge_ecs_target_role.name}"
  path      = "/service-role/"
  policy    = jsonencode({
    Statement = [
        {
            Action    = [
              "ecs:RunTask",
            ]
            Condition = {
                ArnLike = {
                  "ecs:cluster" = "arn:aws:ecs:*:${local.account_id}:cluster/tax-app-cluster"
                }
            }
            Effect    = "Allow"
            Resource  = [
              "arn:aws:ecs:*:${local.account_id}:task-definition/tax-app-task-definition:*",
              "arn:aws:ecs:*:${local.account_id}:task-definition/tax-app-task-definition",
            ]
        },
        {
          Action    = "iam:PassRole"
          Condition = {
              StringLike = {
                "iam:PassedToService" = "ecs-tasks.amazonaws.com"
              }
          }
          Effect    = "Allow"
          Resource  = [
              "*",
          ]
        },
      ]
    Version   = "2012-10-17"
  })
  tags      = {}
  tags_all  = {}
}

#EventBridge ECS Target Policy Attachment
resource "aws_iam_role_policy_attachment" "event_bridge_ecs_target_policy_attachment" {
  role = "${aws_iam_role.event_bridge_ecs_target_role.name}"
  # id         = "Amazon_EventBridge_Invoke_ECS_1220556423-arn:aws:iam::${local.account_id}:policy/${aws_iam_role.event_bridge_ecs_target_role.name}"
  policy_arn = "arn:aws:iam::${local.account_id}:policy/service-role/${aws_iam_role.event_bridge_ecs_target_role.name}"
}


# Lambda Execution Role
 resource "aws_iam_role" "lambda_execution_role" {
    name               = "TaxAppLambda"
    assume_role_policy = jsonencode({
     Version: "2012-10-17",
     Statement:[{
       Effect:"Allow",
       Principal:{
         Service:"lambda.amazonaws.com"},
         Action:"sts:AssumeRole"}
         ]
    })
    managed_policy_arns   = [
    "arn:aws:iam::${local.account_id}:policy/service-role/${aws_iam_policy.event_bridge_ecs_task_policy.name}",
    "arn:aws:iam::aws:policy/AmazonVPCFullAccess",
    "arn:aws:iam::aws:policy/SecretsManagerReadWrite",
    ]
  inline_policy {
    name = "DynamoDBWriteAccess"
    policy = jsonencode({
      Version:"2012-10-17",
      Statement:[{
        Action:[
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
          ],
        Resource:[
          "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/lambda/*:*:*"
          ],
        Effect:"Allow"
      },
      {
        Action:[
          "dynamodb:PutItem",
          "dynamodb:GetItem" 
          ],
        Resource:[
          "arn:aws:dynamodb:${local.region}:${local.account_id}:table/${local.env.REQUEST_TABLE_NAME}"
          ],
          Effect:"Allow"
      },
      {
        Action:[
          "events:PutEvents"
          ],
        Resource:[
          "arn:aws:events:${local.region}:${local.account_id}:event-bus/default"],
        Effect:"Allow"
      },      
    ]})
  }
  tags = {
    STAGE = "dev" 
    }
  tags_all = {
    STAGE = "dev"
   }
 }

resource "aws_iam_policy" "event_bridge_ecs_task_policy" {
  name = "Amazon_EventBridge_Invoke_ECS_Tax-App-Task"
  path = "/service-role/"
  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecs:RunTask"
            ],
            "Resource": [
                "arn:aws:ecs:*:${local.account_id}:task-definition/tax-app-task-definition:*",
                "arn:aws:ecs:*:${local.account_id}:task-definition/tax-app-task-definition"
            ],
            "Condition": {
                "ArnLike": {
                    "ecs:cluster": "arn:aws:ecs:*:${local.account_id}:cluster/tax-app-cluster"
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": [
                "*"
            ],
            "Condition": {
                "StringLike": {
                    "iam:PassedToService": "ecs-tasks.amazonaws.com"
                }
            }
        }
    ]
})
  tags      = {}
}

# ECS task execution role policy attachment
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
