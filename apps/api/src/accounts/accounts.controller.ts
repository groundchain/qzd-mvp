import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { CreateAccountDto, CreateAccountSchema } from './dto/create-account.dto.js';
import { AccountIdSchema } from './dto/account-params.dto.js';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new QZD account.' })
  async create(@Body() dto: CreateAccountDto) {
    const payload = CreateAccountSchema.parse(dto);
    return this.accountsService.createAccount(payload);
  }

  @Get(':id/balance')
  @ApiParam({ name: 'id', description: 'Account identifier (UUID).' })
  @ApiOperation({ summary: 'Retrieve the current balance for an account.' })
  async getBalance(@Param('id') id: string) {
    const { id: accountId } = AccountIdSchema.parse({ id });
    return this.accountsService.getBalance(accountId);
  }

  @Get(':id/history')
  @ApiParam({ name: 'id', description: 'Account identifier (UUID).' })
  @ApiOperation({ summary: 'List the ledger history for an account.' })
  async getHistory(@Param('id') id: string) {
    const { id: accountId } = AccountIdSchema.parse({ id });
    return this.accountsService.getHistory(accountId);
  }
}
