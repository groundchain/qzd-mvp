import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import type { CreateAccountRequest } from '../../generated/server/model/createAccountRequest.js';
import { accountIdSchema, createAccountSchema } from './accounts.schemas.js';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new QZD account.' })
  async create(@Body() dto: CreateAccountRequest) {
    const payload = createAccountSchema.parse(dto);
    return this.accountsService.createAccount(payload);
  }

  @Get(':accountId/balance')
  @ApiParam({ name: 'accountId', description: 'Account identifier (UUID).' })
  @ApiOperation({ summary: 'Retrieve the current balance for an account.' })
  async getBalance(@Param('accountId') accountId: string) {
    const params = accountIdSchema.parse({ accountId });
    return this.accountsService.getBalance(params.accountId);
  }

  @Get(':accountId/history')
  @ApiParam({ name: 'accountId', description: 'Account identifier (UUID).' })
  @ApiOperation({ summary: 'List the ledger history for an account.' })
  async getHistory(@Param('accountId') accountId: string) {
    const params = accountIdSchema.parse({ accountId });
    return this.accountsService.getHistory(params.accountId);
  }
}
